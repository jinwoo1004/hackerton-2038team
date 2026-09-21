using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using MonitoringAgent.Worker.Models;

namespace MonitoringAgent.Worker.Services;

public sealed class SystemMetricsCollector
{
    private ulong _lastIdle;
    private ulong _lastTotal;
    private long _lastRx;
    private long _lastTx;
    private DateTime _lastNetAt;

    public SystemMetricsCollector()
    {
        ReadCpu(out _lastIdle, out _lastTotal);
        (_lastRx, _lastTx) = ReadNetworkBytes();
        _lastNetAt = DateTime.UtcNow;
    }

    public MetricItem Collect()
    {
        var item = new MetricItem { Timestamp = DateTimeOffset.Now, CpuPct = Cpu() };

        var mem = new MemoryStatusEx();
        if (GlobalMemoryStatusEx(mem) && mem.ullTotalPhys > 0)
        {
            var total = mem.ullTotalPhys / 1024d / 1024d;
            var used = (mem.ullTotalPhys - mem.ullAvailPhys) / 1024d / 1024d;
            item.MemoryTotalMb = Math.Round(total);
            item.MemoryUsedMb = Math.Round(used);
            item.MemoryPct = Round(used / total * 100);
        }

        var disk = FullestDrive();
        if (disk is not null)
        {
            item.DiskTotalGb = Round(disk.Value.Total / 1024d / 1024d / 1024d);
            item.DiskUsedGb = Round(disk.Value.Used / 1024d / 1024d / 1024d);
            item.DiskPct = Round(disk.Value.Used * 100d / disk.Value.Total);
        }

        var (rx, tx) = ReadNetworkBytes();
        var now = DateTime.UtcNow;
        var seconds = (now - _lastNetAt).TotalSeconds;
        if (seconds > 0.5 && rx >= _lastRx && tx >= _lastTx)
        {
            item.NetInKbps = Round((rx - _lastRx) * 8 / 1000d / seconds);
            item.NetOutKbps = Round((tx - _lastTx) * 8 / 1000d / seconds);
        }
        _lastRx = rx;
        _lastTx = tx;
        _lastNetAt = now;
        return item;
    }

    private double? Cpu()
    {
        if (!ReadCpu(out var idle, out var total))
        {
            return null;
        }
        var idleDelta = idle - _lastIdle;
        var totalDelta = total - _lastTotal;
        _lastIdle = idle;
        _lastTotal = total;
        if (totalDelta == 0)
        {
            return null;
        }
        return Round((1 - (double)idleDelta / totalDelta) * 100);
    }

    // 여러 드라이브 중 가장 많이 찬 드라이브를 기준으로 본다
    private static (long Used, long Total)? FullestDrive()
    {
        (long Used, long Total)? best = null;
        double bestRatio = -1;
        foreach (var drive in DriveInfo.GetDrives())
        {
            try
            {
                if (drive.DriveType != DriveType.Fixed || !drive.IsReady || drive.TotalSize <= 0)
                {
                    continue;
                }
                var used = drive.TotalSize - drive.TotalFreeSpace;
                var ratio = (double)used / drive.TotalSize;
                if (ratio > bestRatio)
                {
                    bestRatio = ratio;
                    best = (used, drive.TotalSize);
                }
            }
            catch { }
        }
        return best;
    }

    private static (long Rx, long Tx) ReadNetworkBytes()
    {
        long rx = 0;
        long tx = 0;
        try
        {
            foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (nic.OperationalStatus != OperationalStatus.Up
                    || nic.NetworkInterfaceType is NetworkInterfaceType.Loopback or NetworkInterfaceType.Tunnel)
                {
                    continue;
                }
                var stats = nic.GetIPStatistics();
                rx += stats.BytesReceived;
                tx += stats.BytesSent;
            }
        }
        catch { }
        return (rx, tx);
    }

    private static double Round(double value) => Math.Round(Math.Max(0, value), 1);

    private static bool ReadCpu(out ulong idle, out ulong total)
    {
        idle = 0;
        total = 0;
        if (!GetSystemTimes(out var idleTime, out var kernelTime, out var userTime))
        {
            return false;
        }
        idle = idleTime.Value;
        total = kernelTime.Value + userTime.Value;
        return true;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct FileTime
    {
        public uint Low;
        public uint High;
        public ulong Value => ((ulong)High << 32) | Low;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    private sealed class MemoryStatusEx
    {
        public uint dwLength = (uint)Marshal.SizeOf<MemoryStatusEx>();
        public uint dwMemoryLoad;
        public ulong ullTotalPhys;
        public ulong ullAvailPhys;
        public ulong ullTotalPageFile;
        public ulong ullAvailPageFile;
        public ulong ullTotalVirtual;
        public ulong ullAvailVirtual;
        public ulong ullAvailExtendedVirtual;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetSystemTimes(out FileTime idleTime, out FileTime kernelTime, out FileTime userTime);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GlobalMemoryStatusEx([In, Out] MemoryStatusEx buffer);
}

public static class HostInfo
{
    public static string Hostname => Environment.MachineName;

    public static string Os => RuntimeInformation.OSDescription.Trim();

    public static string? PrimaryIPv4()
    {
        try
        {
            return NetworkInterface.GetAllNetworkInterfaces()
                .Where(n => n.OperationalStatus == OperationalStatus.Up
                    && n.NetworkInterfaceType is not (NetworkInterfaceType.Loopback or NetworkInterfaceType.Tunnel))
                .OrderByDescending(n => n.GetIPProperties().GatewayAddresses.Count)
                .SelectMany(n => n.GetIPProperties().UnicastAddresses)
                .Where(a => a.Address.AddressFamily == AddressFamily.InterNetwork)
                .Select(a => a.Address.ToString())
                .FirstOrDefault(a => !a.StartsWith("169.254."));
        }
        catch
        {
            return null;
        }
    }

    public static HeartbeatPayload Heartbeat() => new()
    {
        Hostname = Hostname,
        Os = Os,
        AgentVersion = IngestApiClient.AgentVersion,
        IpAddress = PrimaryIPv4(),
    };
}
