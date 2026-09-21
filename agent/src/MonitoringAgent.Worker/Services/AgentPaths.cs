namespace MonitoringAgent.Worker.Services;

public static class AgentPaths
{
    public static string DataDir { get; set; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "MonitoringAgent");

    public static string ConfigFile => Path.Combine(DataDir, "agent.json");

    public static string StatusFile => Path.Combine(DataDir, "status.json");

    public static string OffsetsFile => Path.Combine(DataDir, "offsets.json");

    public static string SpoolDir => Path.Combine(DataDir, "spool");

    public static string RequestDir => Path.Combine(DataDir, "requests");

    public static string SyncRequestFile => Path.Combine(RequestDir, "sync.request");

    public static string LogDir => Path.Combine(DataDir, "logs");

    public static void EnsureDir(string dir)
    {
        try { Directory.CreateDirectory(dir); }
        catch { }
    }
}
