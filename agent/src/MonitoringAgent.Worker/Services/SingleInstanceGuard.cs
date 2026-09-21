namespace MonitoringAgent.Worker.Services;

public static class SingleInstanceGuard
{
    public const string CollectorLock = "collector";

    private static string LockPath(string name)
    {
        AgentPaths.EnsureDir(AgentPaths.DataDir);
        return Path.Combine(AgentPaths.DataDir, $"{name}.lock");
    }

    public static IDisposable? TryAcquire(string name = CollectorLock)
    {
        try
        {
            return new FileStream(LockPath(name), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        }
        catch (IOException)
        {
            return null;
        }
        // 서비스(SYSTEM)가 만든 잠금 파일은 일반 사용자가 열 수 없으니 이미 실행 중인 것으로 본다
        catch (UnauthorizedAccessException)
        {
            return null;
        }
        catch
        {
            return new MemoryStream();
        }
    }
}
