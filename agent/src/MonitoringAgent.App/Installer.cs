using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.Versioning;
using System.Security.Principal;
using System.ServiceProcess;
using Microsoft.Win32;
using MonitoringAgent.Worker.Services;

namespace MonitoringAgent.App;

[SupportedOSPlatform("windows")]
public static class Installer
{
    public const string ServiceName = "MonitoringAgentService";
    public const string ServiceDisplay = "모니터링 에이전트 서비스";
    public const string TaskName = "Monitoring Agent";

    private const string UninstallKey = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\MonitoringAgent";
    private const string Users = "*S-1-5-32-545";
    private const string Admins = "*S-1-5-32-544";
    private const string System = "*S-1-5-18";

    public static string InstallDir => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "MonitoringAgent");

    public static string InstalledAppExe => Path.Combine(InstallDir, "MonitoringAgentApp.exe");

    public static string InstalledWorkerExe => Path.Combine(InstallDir, "MonitoringAgentService.exe");

    public static bool IsInstalled() => File.Exists(InstalledAppExe);

    public static bool IsServiceInstalled()
    {
        try { return ServiceController.GetServices().Any(s => s.ServiceName == ServiceName); }
        catch { return false; }
    }

    public static bool IsServiceRunning()
    {
        try
        {
            using var sc = new ServiceController(ServiceName);
            return sc.Status == ServiceControllerStatus.Running;
        }
        catch
        {
            return false;
        }
    }

    public static bool IsElevated()
    {
        try
        {
            using var id = WindowsIdentity.GetCurrent();
            return new WindowsPrincipal(id).IsInRole(WindowsBuiltInRole.Administrator);
        }
        catch
        {
            return false;
        }
    }

    public static Process? StartElevatedInstall(string configPath) => StartElevated($"--install --config \"{configPath}\"");

    public static Process? StartElevatedUninstall() => StartElevated("--uninstall-confirmed");

    private static Process? StartElevated(string args)
    {
        try
        {
            var exe = Environment.ProcessPath ?? Process.GetCurrentProcess().MainModule?.FileName;
            if (string.IsNullOrEmpty(exe))
            {
                return null;
            }
            return Process.Start(new ProcessStartInfo
            {
                FileName = exe,
                Arguments = args,
                UseShellExecute = true,
                Verb = "runas",
            });
        }
        catch
        {
            return null;
        }
    }

    public static void RunInstall(string? configPath)
    {
        RunProcess("sc", $"stop {ServiceName}");
        WaitForServiceStop();

        Directory.CreateDirectory(InstallDir);
        CopyBinaries();

        AgentPaths.EnsureDir(AgentPaths.DataDir);
        AgentPaths.EnsureDir(AgentPaths.LogDir);
        AgentPaths.EnsureDir(AgentPaths.SpoolDir);
        AgentPaths.EnsureDir(AgentPaths.RequestDir);
        if (!string.IsNullOrEmpty(configPath) && File.Exists(configPath))
        {
            File.Copy(configPath, AgentPaths.ConfigFile, overwrite: true);
        }

        // 토큰이 든 설정 파일은 관리자와 서비스만 읽고, 트레이는 상태 파일 읽기와 요청 폴더 쓰기만 한다
        RunProcess("icacls", $"\"{AgentPaths.DataDir}\" /inheritance:r /grant:r \"{System}:(OI)(CI)F\" \"{Admins}:(OI)(CI)F\" \"{Users}:(OI)(CI)RX\" /T /C /Q");
        RunProcess("icacls", $"\"{AgentPaths.RequestDir}\" /grant \"{Users}:(OI)(CI)M\" /T /C /Q");
        if (File.Exists(AgentPaths.ConfigFile))
        {
            RunProcess("icacls", $"\"{AgentPaths.ConfigFile}\" /inheritance:r /grant:r \"{System}:F\" \"{Admins}:F\" /C /Q");
        }

        if (File.Exists(InstalledWorkerExe))
        {
            InstallService(InstalledWorkerExe);
        }
        else
        {
            RunProcess("schtasks", $"/create /tn \"{TaskName}\" /tr \"\\\"{InstalledAppExe}\\\" --background\" /sc onstart /ru SYSTEM /rl HIGHEST /f");
            RunProcess("schtasks", $"/run /tn \"{TaskName}\"");
        }

        using var key = Registry.LocalMachine.CreateSubKey(UninstallKey, writable: true);
        key?.SetValue("DisplayName", "Monitoring Agent");
        key?.SetValue("DisplayVersion", IngestApiClient.AgentVersion);
        key?.SetValue("Publisher", "XI S&D");
        key?.SetValue("DisplayIcon", InstalledAppExe);
        key?.SetValue("InstallLocation", InstallDir);
        key?.SetValue("UninstallString", $"\"{InstalledAppExe}\" --uninstall");
        key?.SetValue("NoModify", 1, RegistryValueKind.DWord);
        key?.SetValue("NoRepair", 1, RegistryValueKind.DWord);
    }

    private static void CopyBinaries()
    {
        var srcDir = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
        if (string.Equals(Path.GetFullPath(srcDir), Path.GetFullPath(InstallDir), StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        // 개발 빌드는 dll 이 흩어져 있어 폴더째 복사하고, 배포본은 단일 exe 에 서비스가 들어 있다
        if (File.Exists(Path.Combine(srcDir, "MonitoringAgentApp.dll")))
        {
            foreach (var file in Directory.EnumerateFiles(srcDir, "*", SearchOption.AllDirectories))
            {
                var target = Path.Combine(InstallDir, Path.GetRelativePath(srcDir, file));
                Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                TryCopy(file, target);
            }
            return;
        }

        var exe = Environment.ProcessPath ?? Path.Combine(srcDir, "MonitoringAgentApp.exe");
        TryCopy(exe, InstalledAppExe);
        using var embedded = Assembly.GetExecutingAssembly().GetManifestResourceStream("MonitoringAgentService.exe");
        if (embedded is not null)
        {
            using var fs = File.Create(InstalledWorkerExe);
            embedded.CopyTo(fs);
        }
    }

    private static void InstallService(string workerExe)
    {
        RunProcess("sc", $"delete {ServiceName}");
        RunProcess("sc", $"create {ServiceName} binPath= \"\\\"{workerExe}\\\"\" start= auto DisplayName= \"{ServiceDisplay}\"");
        RunProcess("sc", $"description {ServiceName} \"Monitoring Platform 로그와 서버 자원 수집\"");
        RunProcess("sc", $"failure {ServiceName} reset= 86400 actions= restart/5000/restart/5000/restart/30000");
        RunProcess("sc", $"start {ServiceName}");
    }

    public static void RunUninstall()
    {
        foreach (var p in Process.GetProcessesByName("MonitoringAgentApp"))
        {
            try
            {
                if (p.Id != Environment.ProcessId)
                {
                    p.Kill();
                }
            }
            catch { }
        }

        RunProcess("sc", $"stop {ServiceName}");
        WaitForServiceStop();
        RunProcess("sc", $"delete {ServiceName}");
        RunProcess("schtasks", $"/end /tn \"{TaskName}\"");
        RunProcess("schtasks", $"/delete /tn \"{TaskName}\" /f");

        try { Registry.LocalMachine.DeleteSubKeyTree(UninstallKey, throwOnMissingSubKey: false); }
        catch { }
        try { AutostartManager.Disable(); }
        catch { }

        var cmd = $"/c ping 127.0.0.1 -n 3 >nul & rmdir /s /q \"{AgentPaths.DataDir}\" & rmdir /s /q \"{InstallDir}\"";
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = cmd,
                CreateNoWindow = true,
                UseShellExecute = false,
                WorkingDirectory = Path.GetTempPath(),
            });
        }
        catch { }
    }

    private static void WaitForServiceStop()
    {
        for (var i = 0; i < 30; i++)
        {
            if (!IsServiceRunning())
            {
                return;
            }
            Thread.Sleep(300);
        }
    }

    private static void TryCopy(string from, string to)
    {
        try { File.Copy(from, to, overwrite: true); }
        catch { }
    }

    private static void RunProcess(string file, string args)
    {
        try
        {
            using var p = Process.Start(new ProcessStartInfo
            {
                FileName = file,
                Arguments = args,
                CreateNoWindow = true,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            });
            p?.WaitForExit(30_000);
        }
        catch { }
    }
}
