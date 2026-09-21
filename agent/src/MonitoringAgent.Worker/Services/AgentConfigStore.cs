using System.Text.Json;
using System.Text.Json.Serialization;
using MonitoringAgent.Worker.Models;

namespace MonitoringAgent.Worker.Services;

public static class AgentJson
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = false,
        Converters = { new JsonStringEnumConverter() },
    };

    public static readonly JsonSerializerOptions Pretty = new(Options) { WriteIndented = true };
}

public sealed class AgentConfigStore
{
    private readonly string _path;
    private DateTime _loadedStamp;

    public AgentConfigStore(string? path = null)
    {
        _path = path ?? AgentPaths.ConfigFile;
    }

    public string Path => _path;

    public AgentOptions Load()
    {
        try
        {
            if (!File.Exists(_path))
            {
                _loadedStamp = DateTime.MinValue;
                return new AgentOptions();
            }
            _loadedStamp = File.GetLastWriteTimeUtc(_path);
            var json = File.ReadAllText(_path);
            return Normalize(JsonSerializer.Deserialize<AgentOptions>(json, AgentJson.Options) ?? new AgentOptions());
        }
        catch
        {
            return new AgentOptions();
        }
    }

    public bool HasChanged()
    {
        try
        {
            var stamp = File.Exists(_path) ? File.GetLastWriteTimeUtc(_path) : DateTime.MinValue;
            return stamp != _loadedStamp;
        }
        catch
        {
            return false;
        }
    }

    public static void Save(string path, AgentOptions options)
    {
        var dir = System.IO.Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(dir))
        {
            Directory.CreateDirectory(dir);
        }
        File.WriteAllText(path, JsonSerializer.Serialize(Normalize(options), AgentJson.Pretty));
    }

    private static AgentOptions Normalize(AgentOptions o)
    {
        o.Server = o.Server?.Trim() ?? string.Empty;
        o.Token = o.Token?.Trim() ?? string.Empty;
        o.Logs = (o.Logs ?? new List<LogSource>())
            .Where(l => !string.IsNullOrWhiteSpace(l.Path))
            .Select(l => new LogSource { Path = Environment.ExpandEnvironmentVariables(l.Path.Trim()) })
            .DistinctBy(l => l.Path, StringComparer.OrdinalIgnoreCase)
            .ToList();
        o.MetricsIntervalSeconds = Math.Clamp(o.MetricsIntervalSeconds, 5, 3600);
        o.HeartbeatIntervalSeconds = Math.Clamp(o.HeartbeatIntervalSeconds, 10, 600);
        o.LogFlushSeconds = Math.Clamp(o.LogFlushSeconds, 1, 120);
        o.LogBatchSize = Math.Clamp(o.LogBatchSize, 10, 1000);
        o.SpoolMaxMb = Math.Clamp(o.SpoolMaxMb, 1, 2048);
        o.TimeoutSeconds = Math.Clamp(o.TimeoutSeconds, 3, 120);
        return o;
    }
}
