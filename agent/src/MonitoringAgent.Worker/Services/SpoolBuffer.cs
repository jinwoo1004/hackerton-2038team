using Microsoft.Extensions.Logging;

namespace MonitoringAgent.Worker.Services;

public sealed class SpoolBuffer
{
    private readonly ILogger _logger;
    private readonly string _dir;
    private readonly Func<long> _maxBytes;
    private readonly object _gate = new();

    public SpoolBuffer(ILogger logger, Func<long> maxBytes, string? dir = null)
    {
        _logger = logger;
        _maxBytes = maxBytes;
        _dir = dir ?? AgentPaths.SpoolDir;
    }

    public int Count
    {
        get
        {
            try { return Directory.Exists(_dir) ? Directory.GetFiles(_dir, "*.json").Length : 0; }
            catch { return 0; }
        }
    }

    public void Save(string path, byte[] json)
    {
        lock (_gate)
        {
            try
            {
                Directory.CreateDirectory(_dir);
                var kind = path.Contains("logs", StringComparison.Ordinal) ? "logs" : "metrics";
                var name = $"{DateTime.UtcNow.Ticks:D20}-{kind}-{Guid.NewGuid():N}.json";
                File.WriteAllBytes(Path.Combine(_dir, name), json);
                Trim();
            }
            catch (Exception ex)
            {
                _logger.LogWarning("보내지 못한 데이터를 저장하지 못했습니다: {Message}", ex.Message);
            }
        }
    }

    public async Task<int> DrainAsync(IngestApiClient client, CancellationToken ct)
    {
        string[] files;
        lock (_gate)
        {
            if (!Directory.Exists(_dir))
            {
                return 0;
            }
            files = Directory.GetFiles(_dir, "*.json").OrderBy(f => f, StringComparer.Ordinal).ToArray();
        }

        var sent = 0;
        foreach (var file in files)
        {
            byte[] body;
            try { body = await File.ReadAllBytesAsync(file, ct); }
            catch { continue; }

            var path = Path.GetFileName(file).Contains("-logs-", StringComparison.Ordinal)
                ? "/api/ingest/logs"
                : "/api/ingest/metrics";
            var result = await client.SendRawAsync(path, body, ct);
            if (!result.Ok)
            {
                // 형식 오류로 거절된 묶음은 다시 보내도 소용없어 버린다
                if (result.Reason is ServerReason.BadResponse or ServerReason.TooLarge)
                {
                    TryDelete(file);
                    continue;
                }
                break;
            }
            TryDelete(file);
            sent++;
        }
        if (sent > 0)
        {
            _logger.LogInformation("밀려 있던 데이터 {Count}묶음을 다시 보냈습니다.", sent);
        }
        return sent;
    }

    private void Trim()
    {
        var files = new DirectoryInfo(_dir).GetFiles("*.json").OrderBy(f => f.Name, StringComparer.Ordinal).ToList();
        var total = files.Sum(f => f.Length);
        var max = _maxBytes();
        var i = 0;
        while (total > max && i < files.Count)
        {
            total -= files[i].Length;
            TryDelete(files[i].FullName);
            i++;
        }
        if (i > 0)
        {
            _logger.LogWarning("보관 한도를 넘어 오래된 데이터 {Count}묶음을 지웠습니다.", i);
        }
    }

    private static void TryDelete(string file)
    {
        try { File.Delete(file); }
        catch { }
    }
}
