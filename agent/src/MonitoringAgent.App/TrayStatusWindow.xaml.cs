using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Threading;
using MonitoringAgent.Worker.Services;

namespace MonitoringAgent.App;

public partial class TrayStatusWindow : Window
{
    private static readonly Brush Ink = new SolidColorBrush(Color.FromRgb(0x11, 0x11, 0x11));
    private static readonly Brush Sub = new SolidColorBrush(Color.FromRgb(0x8B, 0x95, 0xA1));
    private static readonly Brush Bad = new SolidColorBrush(Color.FromRgb(0xF0, 0x4A, 0x4A));
    private static readonly Brush Good = new SolidColorBrush(Color.FromRgb(0x22, 0xC5, 0x5E));
    private static readonly Brush Idle = new SolidColorBrush(Color.FromRgb(0xB0, 0xB8, 0xC1));

    private readonly DispatcherTimer _timer = new() { Interval = TimeSpan.FromSeconds(2) };

    public TrayStatusWindow()
    {
        InitializeComponent();
        ApplyLanguage();
        Refresh();
        AgentStatus.Changed += OnStatusChanged;
        _timer.Tick += (_, _) => Refresh();
        IsVisibleChanged += (_, _) =>
        {
            if (IsVisible) { Refresh(); _timer.Start(); }
            else { _timer.Stop(); }
        };
        Closed += (_, _) =>
        {
            AgentStatus.Changed -= OnStatusChanged;
            _timer.Stop();
        };
    }

    private static bool InProcess => BackgroundAgent.Current is not null;

    private void OnStatusChanged() => Dispatcher.BeginInvoke(Refresh);

    private void ApplyLanguage()
    {
        OpenLogButton.Content = Loc.T("tray.btn.openLog");
        QuitButton.Content = InProcess ? Loc.T("tray.btn.quit") : Loc.T("tray.btn.closeTray");
        DisableAutostartRun.Text = Loc.T("tray.disableAutostart");
        if (SyncButton.IsEnabled)
        {
            SyncButton.Content = Loc.T("tray.btn.sync");
        }
        Highlight(TrayLangKo, Loc.Current == AppLanguage.Korean);
        Highlight(TrayLangJa, Loc.Current == AppLanguage.Japanese);
        Highlight(TrayLangEn, Loc.Current == AppLanguage.English);

        static void Highlight(TextBlock tb, bool active)
        {
            tb.Foreground = active
                ? new SolidColorBrush(Color.FromRgb(0x31, 0x82, 0xF6))
                : new SolidColorBrush(Color.FromRgb(0x8B, 0x95, 0xA1));
            tb.FontWeight = active ? FontWeights.Bold : FontWeights.Normal;
        }
    }

    private void TrayLang_Click(object sender, System.Windows.Input.MouseButtonEventArgs e)
    {
        if (sender is TextBlock tb && tb.Tag is string tag && Enum.TryParse(tag, out AppLanguage language))
        {
            Loc.Set(language);
            Loc.Save(language);
            ApplyLanguage();
            Refresh();
        }
    }

    private void Refresh()
    {
        var s = InProcess ? AgentStatus.Current : AgentStatus.ReadFile();
        var alive = s is not null && (InProcess || Installer.IsServiceRunning()
            || DateTimeOffset.Now - s.UpdatedAt < TimeSpan.FromMinutes(2));

        TrayStatusText.Text = !alive
            ? Loc.T("tray.status.stopped")
            : s!.Mode == "service" ? Loc.T("tray.status.service") : Loc.T("tray.status.running");
        StateDot.Fill = !alive ? Idle : s!.ServerReachable == false ? Bad : Good;

        StatusPanel.Children.Clear();
        var dash = Loc.T("val.dash");
        if (s is null)
        {
            AddRow(Loc.T("tray.row.server"), dash);
            return;
        }

        AddRow(Loc.T("tray.row.project"), string.IsNullOrEmpty(s.ProjectName) ? dash : s.ProjectName!);
        AddRow(Loc.T("row.agent"), string.IsNullOrEmpty(s.AgentName) ? dash : s.AgentName!);

        var server = s.ServerReachable switch
        {
            true => Loc.T("tray.val.connected"),
            false => Loc.T("tray.val.disconnected"),
            _ => Loc.T("tray.val.checking"),
        };
        AddRow(Loc.T("tray.row.server"), server, s.ServerReachable == false);
        if (s.ServerReachable == false || s.LastReason == ServerReason.NotConfigured)
        {
            AddDetail(Loc.Reason(s.LastReason));
        }

        AddRow(Loc.T("tray.row.heartbeat"), Time(s.LastHeartbeat));
        AddRow(Loc.T("tray.row.logs"), Time(s.LastLogSent));
        AddRow(Loc.T("tray.row.sent"), Loc.T("tray.val.count", s.LogsSent.ToString("N0")));
        AddRow(Loc.T("tray.row.files"), Loc.T("tray.val.files", s.WatchedFiles));
        AddRow(Loc.T("row.usage"), s.CpuPct is null ? dash : $"{s.CpuPct:0}% / {s.MemoryPct:0}%");
        if (s.Spooled > 0)
        {
            AddRow(Loc.T("tray.row.spool"), Loc.T("tray.val.spool", s.Spooled), true);
        }
    }

    private static string Time(DateTimeOffset? t) => t is null ? "-" : t.Value.ToLocalTime().ToString("HH:mm:ss");

    private void AddRow(string label, string value, bool muted = false)
    {
        if (StatusPanel.Children.Count > 0)
        {
            StatusPanel.Children.Add(new Border { Height = 1, Background = new SolidColorBrush(Color.FromRgb(0xED, 0xEE, 0xF0)) });
        }
        var grid = new Grid { Margin = new Thickness(0, 11, 0, 11) };
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(104) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

        var labelBlock = new TextBlock { Text = label, Foreground = Sub, FontSize = 13, VerticalAlignment = VerticalAlignment.Center };
        var valueBlock = new TextBlock
        {
            Text = value,
            Foreground = muted ? Bad : Ink,
            FontSize = 13,
            FontWeight = FontWeights.SemiBold,
            TextAlignment = TextAlignment.Right,
            TextTrimming = TextTrimming.CharacterEllipsis,
            HorizontalAlignment = HorizontalAlignment.Right,
            VerticalAlignment = VerticalAlignment.Center,
            ToolTip = value,
        };
        Grid.SetColumn(valueBlock, 1);
        grid.Children.Add(labelBlock);
        grid.Children.Add(valueBlock);
        StatusPanel.Children.Add(grid);
    }

    private void AddDetail(string text)
    {
        StatusPanel.Children.Add(new TextBlock
        {
            Text = text,
            Foreground = Bad,
            FontSize = 12,
            TextWrapping = TextWrapping.Wrap,
            LineHeight = 18,
            Margin = new Thickness(0, 0, 0, 11),
        });
    }

    private async void Sync_Click(object sender, RoutedEventArgs e)
    {
        SyncButton.IsEnabled = false;
        SyncButton.Content = Loc.T("tray.btn.syncing");
        try
        {
            var scheduler = BackgroundAgent.Current;
            if (scheduler is not null)
            {
                await scheduler.RunOnceAsync(BackgroundAgent.Token);
            }
            else
            {
                AgentPaths.EnsureDir(AgentPaths.RequestDir);
                await File.WriteAllTextAsync(AgentPaths.SyncRequestFile, DateTimeOffset.Now.ToString("O"));
                await Task.Delay(2500);
            }
        }
        catch { }
        finally
        {
            SyncButton.Content = Loc.T("tray.btn.sync");
            SyncButton.IsEnabled = true;
            Refresh();
        }
    }

    private void OpenLog_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            Process.Start(new ProcessStartInfo { FileName = AgentPaths.LogDir, UseShellExecute = true });
        }
        catch { }
    }

    private void Quit_Click(object sender, RoutedEventArgs e) => Application.Current.Shutdown();

    private void DisableAutostart_Click(object sender, RoutedEventArgs e)
    {
        try { AutostartManager.Disable(); }
        catch { }
        Application.Current.Shutdown();
    }

    private void Window_Deactivated(object? sender, EventArgs e) => Hide();
}
