using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace MonitoringAgent.Worker.Services;

public static partial class LogLineParser
{
    public const int MaxMessage = 8000;

    [GeneratedRegex(@"^\[?(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,7})?(?:Z|[+-]\d{2}:?\d{2})?)")]
    private static partial Regex TimestampHead();

    [GeneratedRegex(@"\b(TRACE|DEBUG|INFO|NOTICE|WARN|WARNING|ERROR|ERR|SEVERE|FATAL|CRITICAL|CRIT)\b")]
    private static partial Regex UpperLevel();

    [GeneratedRegex(@"\[(trace|debug|info|notice|warn|warning|error|crit|alert|emerg)\]", RegexOptions.IgnoreCase)]
    private static partial Regex BracketLevel();

    public static bool IsContinuation(string line)
    {
        if (line.Length == 0)
        {
            return false;
        }
        if (char.IsWhiteSpace(line[0]))
        {
            return true;
        }
        return line.StartsWith("at ", StringComparison.Ordinal)
            || line.StartsWith("Caused by", StringComparison.Ordinal)
            || line.StartsWith("--- ", StringComparison.Ordinal)
            || line.StartsWith("...", StringComparison.Ordinal);
    }

    public static DateTimeOffset? ParseTimestamp(string line)
    {
        var match = TimestampHead().Match(line);
        if (!match.Success)
        {
            return null;
        }
        var text = match.Groups[1].Value.Replace(',', '.');
        return DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var ts)
            ? ts
            : null;
    }

    public static string ParseLevel(string line)
    {
        var head = line.Length > 200 ? line[..200] : line;
        var upper = UpperLevel().Match(head);
        if (upper.Success)
        {
            return Normalize(upper.Groups[1].Value);
        }
        var bracket = BracketLevel().Match(head);
        return bracket.Success ? Normalize(bracket.Groups[1].Value) : "UNKNOWN";
    }

    public static string Normalize(string level) => level.ToUpperInvariant() switch
    {
        "TRACE" or "VERBOSE" => "TRACE",
        "DEBUG" or "DBG" => "DEBUG",
        "INFO" or "INFORMATION" or "NOTICE" => "INFO",
        "WARN" or "WARNING" => "WARN",
        "ERROR" or "ERR" or "SEVERE" => "ERROR",
        "FATAL" or "CRITICAL" or "CRIT" or "ALERT" or "EMERG" or "PANIC" => "FATAL",
        _ => "UNKNOWN",
    };

    public static (DateTimeOffset? Timestamp, string Level, string Message)? TryParseJson(string line)
    {
        if (line.Length < 2 || line[0] != '{')
        {
            return null;
        }
        try
        {
            using var doc = JsonDocument.Parse(line);
            var root = doc.RootElement;
            var level = First(root, "level", "severity", "lvl", "@l", "log.level") ?? "UNKNOWN";
            var message = First(root, "message", "msg", "@m", "@mt") ?? line;
            var exception = First(root, "exception", "stack_trace", "stacktrace", "@x");
            if (exception is not null)
            {
                message = message + Environment.NewLine + exception;
            }
            DateTimeOffset? ts = null;
            var tsText = First(root, "timestamp", "@timestamp", "time", "@t", "ts");
            if (tsText is not null && DateTimeOffset.TryParse(tsText, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var parsed))
            {
                ts = parsed;
            }
            return (ts, Normalize(level), message);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? First(JsonElement root, params string[] names)
    {
        foreach (var name in names)
        {
            if (root.TryGetProperty(name, out var value))
            {
                return value.ValueKind switch
                {
                    JsonValueKind.String => value.GetString(),
                    JsonValueKind.Number or JsonValueKind.True or JsonValueKind.False => value.GetRawText(),
                    _ => null,
                };
            }
        }
        return null;
    }

    public static string Cut(string message) =>
        message.Length > MaxMessage ? message[..MaxMessage] : message;
}
