using System.Runtime.Versioning;
using Microsoft.Win32;

namespace MonitoringAgent.Worker.Services;

[SupportedOSPlatform("windows")]
public static class AutostartManager
{
    private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string ValueName = "Monitoring Agent";

    public static void Enable(string executablePath)
    {
        using var key = Registry.CurrentUser.CreateSubKey(RunKeyPath, writable: true);
        key?.SetValue(ValueName, $"\"{executablePath}\" --background");
    }

    public static void Disable()
    {
        using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, writable: true);
        if (key?.GetValue(ValueName) is not null)
        {
            key.DeleteValue(ValueName, throwOnMissingValue: false);
        }
    }

    public static bool IsEnabled()
    {
        using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, writable: false);
        return key?.GetValue(ValueName) is not null;
    }
}
