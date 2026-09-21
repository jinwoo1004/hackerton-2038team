using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using MonitoringAgent.Worker.Models;

namespace MonitoringAgent.Worker.Services;

public sealed class LogTailer
{
    private const int MaxReadBytes = 1 << 20;
    private const int MaxFiles = 200;
    private static readonly TimeSpan PendingHold = TimeSpan.FromMilliseconds(1500);

    private readonly ILogger _logger;
    private readonly string _offsetsPath;
    private readonly Dictionary<string, Cursor> _cursors = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, SavedOffset> _saved;
    private List<LogSource> _sources = new();
    private bool _initialized;

    public LogTailer(ILogger logger, string? offsetsPath = null)
    {
        _logger = logger;
        _offsetsPath = offsetsPath ?? AgentPaths.OffsetsFile;
        _saved = LoadOffsets();
    }

    public int WatchedFiles => _cursors.Count;

    public void SetSources(IEnumerable<LogSource> sources)
    {
        _sources = sources.ToList();
    }

    public List<LogItem> Poll()
    {
        var items = new List<LogItem>();
        var files = Resolve();
        var now = DateTime.UtcNow;

        foreach (var gone in _cursors.Keys.Where(k => !files.Contains(k)).ToList())
        {
            Flush(_cursors[gone], items);
            _cursors.Remove(gone);
        }

        foreach (var file in files)
        {
            if (!_cursors.TryGetValue(file, out var cursor))
            {
                cursor = Start(file);
                _cursors[file] = cursor;
            }
            try
            {
                Read(file, cursor, items, now);
            }
            catch (FileNotFoundException) { }
            catch (DirectoryNotFoundException) { }
            catch (IOException ex)
            {
                _logger.LogDebug("로그 파일을 읽지 못했습니다 {File}: {Message}", file, ex.Message);
            }
            catch (UnauthorizedAccessException)
            {
                _logger.LogWarning("로그 파일 읽기 권한이 없습니다 {File}", file);
            }

            if (cursor.Pending is not null && now - cursor.PendingAt > PendingHold)
            {
                Flush(cursor, items);
            }
        }

        _initialized = true;
        return items;
    }

    public void Commit()
    {
        try
        {
            var data = _cursors.ToDictionary(k => k.Key, v => new SavedOffset(v.Value.Offset, v.Value.Created),
                StringComparer.OrdinalIgnoreCase);
            var dir = Path.GetDirectoryName(_offsetsPath);
            if (!string.IsNullOrEmpty(dir))
            {
                Directory.CreateDirectory(dir);
            }
            File.WriteAllText(_offsetsPath, JsonSerializer.Serialize(data, AgentJson.Options));
        }
        catch (Exception ex)
        {
            _logger.LogDebug("읽은 위치를 저장하지 못했습니다: {Message}", ex.Message);
        }
    }

    internal HashSet<string> Resolve()
    {
        var found = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var source in _sources)
        {
            foreach (var file in Expand(source.Path))
            {
                if (found.Count >= MaxFiles)
                {
                    return found;
                }
                found.Add(file);
            }
        }
        return found;
    }

    public static IEnumerable<string> Expand(string pattern)
    {
        if (string.IsNullOrWhiteSpace(pattern))
        {
            return Array.Empty<string>();
        }
        try
        {
            if (Directory.Exists(pattern))
            {
                return Directory.EnumerateFiles(pattern, "*.log", SearchOption.TopDirectoryOnly).ToList();
            }
            if (File.Exists(pattern))
            {
                return new[] { Path.GetFullPath(pattern) };
            }
            var dir = Path.GetDirectoryName(pattern);
            var mask = Path.GetFileName(pattern);
            if (string.IsNullOrEmpty(dir))
            {
                return Array.Empty<string>();
            }
            var option = SearchOption.TopDirectoryOnly;
            if (Path.GetFileName(dir) == "**")
            {
                option = SearchOption.AllDirectories;
                dir = Path.GetDirectoryName(dir);
            }
            if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir))
            {
                return Array.Empty<string>();
            }
            return Directory.EnumerateFiles(dir, string.IsNullOrEmpty(mask) ? "*.log" : mask, option).ToList();
        }
        catch
        {
            return Array.Empty<string>();
        }
    }

    private Cursor Start(string file)
    {
        var info = new FileInfo(file);
        var created = info.Exists ? info.CreationTimeUtc.Ticks : 0;
        if (_saved.TryGetValue(file, out var saved) && saved.Created == created && info.Exists && info.Length >= saved.Offset)
        {
            return new Cursor { Offset = saved.Offset, Created = created };
        }
        // 처음 켜질 때 이미 있던 내용은 보내지 않고, 켜진 뒤 새로 생긴 파일은 처음부터 읽는다
        var offset = _initialized || !info.Exists ? 0 : info.Length;
        return new Cursor { Offset = offset, Created = created };
    }

    private void Read(string file, Cursor cursor, List<LogItem> items, DateTime now)
    {
        using var fs = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        var length = fs.Length;
        var created = File.GetCreationTimeUtc(file).Ticks;
        if (length < cursor.Offset || (cursor.Created != 0 && created != cursor.Created))
        {
            Flush(cursor, items);
            cursor.Offset = 0;
        }
        cursor.Created = created;
        if (length <= cursor.Offset)
        {
            return;
        }

        fs.Seek(cursor.Offset, SeekOrigin.Begin);
        var toRead = (int)Math.Min(MaxReadBytes, length - cursor.Offset);
        var buffer = new byte[toRead];
        var read = 0;
        while (read < toRead)
        {
            var n = fs.Read(buffer, read, toRead - read);
            if (n == 0)
            {
                break;
            }
            read += n;
        }
        if (read == 0)
        {
            return;
        }

        var lastNewline = Array.LastIndexOf(buffer, (byte)'\n', read - 1);
        int consumed;
        if (lastNewline >= 0)
        {
            consumed = lastNewline + 1;
        }
        else if (read == MaxReadBytes)
        {
            consumed = read;
        }
        else
        {
            return;
        }

        var start = cursor.Offset == 0 && consumed >= 3 && buffer[0] == 0xEF && buffer[1] == 0xBB && buffer[2] == 0xBF ? 3 : 0;
        var text = Encoding.UTF8.GetString(buffer, start, consumed - start);
        cursor.Offset += consumed;

        foreach (var raw in text.Split('\n'))
        {
            var line = raw.TrimEnd('\r');
            if (line.Length == 0)
            {
                continue;
            }
            if (cursor.Pending is not null && LogLineParser.IsContinuation(line))
            {
                if (cursor.Pending.Text.Length < LogLineParser.MaxMessage)
                {
                    cursor.Pending.Text.Append('\n').Append(line);
                }
                continue;
            }
            Flush(cursor, items);
            cursor.Pending = NewEntry(file, line);
        }
        cursor.PendingAt = now;
    }

    private static Entry NewEntry(string file, string line)
    {
        var json = LogLineParser.TryParseJson(line);
        if (json is not null)
        {
            return new Entry(file, json.Value.Timestamp, json.Value.Level, json.Value.Message);
        }
        return new Entry(file, LogLineParser.ParseTimestamp(line), LogLineParser.ParseLevel(line), line);
    }

    private static void Flush(Cursor cursor, List<LogItem> items)
    {
        var entry = cursor.Pending;
        if (entry is null)
        {
            return;
        }
        cursor.Pending = null;
        items.Add(new LogItem
        {
            Timestamp = entry.Timestamp ?? DateTimeOffset.Now,
            Level = entry.Level,
            Source = entry.Source.Length > 255 ? entry.Source[^255..] : entry.Source,
            Message = LogLineParser.Cut(entry.Text.ToString()),
        });
    }

    private Dictionary<string, SavedOffset> LoadOffsets()
    {
        try
        {
            if (File.Exists(_offsetsPath))
            {
                var data = JsonSerializer.Deserialize<Dictionary<string, SavedOffset>>(File.ReadAllText(_offsetsPath), AgentJson.Options);
                if (data is not null)
                {
                    return new Dictionary<string, SavedOffset>(data, StringComparer.OrdinalIgnoreCase);
                }
            }
        }
        catch { }
        return new Dictionary<string, SavedOffset>(StringComparer.OrdinalIgnoreCase);
    }

    private sealed class Cursor
    {
        public long Offset { get; set; }
        public long Created { get; set; }
        public Entry? Pending { get; set; }
        public DateTime PendingAt { get; set; }
    }

    private sealed class Entry
    {
        public Entry(string source, DateTimeOffset? timestamp, string level, string text)
        {
            Source = source;
            Timestamp = timestamp;
            Level = level;
            Text = new StringBuilder(text);
        }

        public string Source { get; }
        public DateTimeOffset? Timestamp { get; }
        public string Level { get; }
        public StringBuilder Text { get; }
    }

    public sealed record SavedOffset(long Offset, long Created);
}
