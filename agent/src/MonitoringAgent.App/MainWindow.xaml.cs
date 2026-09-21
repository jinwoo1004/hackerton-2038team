using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Threading;
using Microsoft.Extensions.Logging.Abstractions;
using MonitoringAgent.Worker.Models;
using MonitoringAgent.Worker.Services;
using WinForms = System.Windows.Forms;

namespace MonitoringAgent.App;

public partial class MainWindow : Window
{
    private static readonly Brush Ink = new SolidColorBrush(Color.FromRgb(0x11, 0x11, 0x11));
    private static readonly Brush Sub = new SolidColorBrush(Color.FromRgb(0x8B, 0x95, 0xA1));
    private static readonly Brush Muted = new SolidColorBrush(Color.FromRgb(0xB0, 0xB8, 0xC1));
    private static readonly Brush Accent = new SolidColorBrush(Color.FromRgb(0x31, 0x82, 0xF6));
    private static readonly Brush Line = new SolidColorBrush(Color.FromRgb(0xED, 0xEE, 0xF0));

    private static readonly string[] CandidateFolders =
    {
        @"C:\logs", @"D:\logs", @"C:\app\logs", @"D:\app\logs", @"C:\apps\logs",
        @"C:\inetpub\logs\LogFiles", @"C:\tomcat\logs", @"C:\nginx\logs", @"C:\Apache24\logs",
    };

    private readonly List<string> _logPaths = new();
    private HeartbeatResponse? _connected;
    private bool _running;
    private DispatcherTimer? _rollTimer;
    private int _rollIndex;

    public MainWindow()
    {
        InitializeComponent();
        PreselectLanguage(Loc.Current);
        ApplyLanguage();
        StartLangRolling();
        Prefill();
    }

    private void Prefill()
    {
        var existing = new AgentConfigStore().Load();
        ServerInput.Text = existing.Server;
        TokenInput.Text = existing.Token;
        _logPaths.AddRange(existing.Logs.Select(l => l.Path));
    }

    private void PreselectLanguage(AppLanguage language)
    {
        LangKo.IsChecked = language == AppLanguage.Korean;
        LangJa.IsChecked = language == AppLanguage.Japanese;
        LangEn.IsChecked = language == AppLanguage.English;
    }

    private AppLanguage SelectedLanguage()
    {
        if (LangJa.IsChecked == true) return AppLanguage.Japanese;
        if (LangEn.IsChecked == true) return AppLanguage.English;
        return AppLanguage.Korean;
    }

    private void ApplyLanguage()
    {
        LangNextButton.Content = Loc.T("lang.next");

        StartTitle.Text = Loc.T("start.title");
        StartSubtitle.Text = Loc.T("start.subtitle");
        InfoTitle.Text = Loc.T("start.infoTitle");
        InfoBody.Text = Loc.T("start.infoBody");
        StartButton.Content = Loc.T("start.button");
        StartFooter.Text = Loc.T("start.footer");
        ChangeLangRun.Text = Loc.T("lang.change");

        ConnectTitle.Text = Loc.T("connect.title");
        ConnectSubtitle.Text = Loc.T("connect.subtitle");
        ServerLabel.Text = Loc.T("connect.server");
        TokenLabel.Text = Loc.T("connect.token");
        ConnectButton.Content = Loc.T("connect.button");
        ConnectBackButton.Content = Loc.T("connect.back");

        LogsTitle.Text = Loc.T("logs.title");
        LogsSubtitle.Text = Loc.T("logs.subtitle");
        LogEmptyText.Text = Loc.T("logs.empty");
        AddFolderText.Text = Loc.T("logs.addFolder");
        PatternLabel.Text = Loc.T("logs.pattern");
        AddPatternButton.Content = Loc.T("logs.add");
        SuggestLabel.Text = Loc.T("logs.suggest");
        InstallButton.Content = Loc.T("logs.button");
        LogsBackButton.Content = Loc.T("connect.back");

        ProgressTitle.Text = Loc.T("progress.title");
        ProgressStatus.Text = Loc.T("progress.status");
        DoneCloseButton.Content = Loc.T("done.close");
    }

    private void Show(Panel panel)
    {
        foreach (var p in new Panel[] { LanguagePanel, StartPanel, ConnectPanel, LogsPanel, ProgressPanel, DonePanel })
        {
            p.Visibility = p == panel ? Visibility.Visible : Visibility.Collapsed;
        }
        Scroller.ScrollToTop();
    }

    private void StartLangRolling()
    {
        _rollIndex = 0;
        ShowLangFrame(0);
        LangRollGroup.Opacity = 1;
        _rollTimer ??= new DispatcherTimer { Interval = TimeSpan.FromSeconds(2.4) };
        _rollTimer.Tick -= Roll_Tick;
        _rollTimer.Tick += Roll_Tick;
        _rollTimer.Start();
    }

    private void StopLangRolling() => _rollTimer?.Stop();

    private void Roll_Tick(object? sender, EventArgs e)
    {
        _rollIndex = (_rollIndex + 1) % 3;
        var dur = TimeSpan.FromMilliseconds(240);
        var fadeOut = new DoubleAnimation(1, 0, dur);
        fadeOut.Completed += (_, _) =>
        {
            ShowLangFrame(_rollIndex);
            LangRollTransform.BeginAnimation(TranslateTransform.YProperty, new DoubleAnimation(12, 0, dur));
            LangRollGroup.BeginAnimation(OpacityProperty, new DoubleAnimation(0, 1, dur));
        };
        LangRollTransform.BeginAnimation(TranslateTransform.YProperty, new DoubleAnimation(0, -12, dur));
        LangRollGroup.BeginAnimation(OpacityProperty, fadeOut);
    }

    private void ShowLangFrame(int index)
    {
        LangTitle.Text = Loc.Variant("lang.title", index);
        LangSubtitle.Text = Loc.Variant("lang.subtitle", index);
    }

    private void LangNext_Click(object sender, RoutedEventArgs e)
    {
        var language = SelectedLanguage();
        Loc.Set(language);
        Loc.Save(language);
        StopLangRolling();
        ApplyLanguage();
        Show(StartPanel);
    }

    private void ChangeLanguage_Click(object sender, RoutedEventArgs e)
    {
        PreselectLanguage(Loc.Current);
        Show(LanguagePanel);
        StartLangRolling();
    }

    private void Start_Click(object sender, RoutedEventArgs e)
    {
        Show(ConnectPanel);
        (string.IsNullOrWhiteSpace(ServerInput.Text) ? ServerInput : TokenInput).Focus();
    }

    private void ConnectBack_Click(object sender, RoutedEventArgs e) => Show(StartPanel);

    private void ConnectInput_Changed(object sender, TextChangedEventArgs e)
    {
        _connected = null;
        ConnectMessageBox.Visibility = Visibility.Collapsed;
        ServerBox.BorderBrush = Brushes.Transparent;
        TokenBox.BorderBrush = Brushes.Transparent;
    }

    private async void Connect_Click(object sender, RoutedEventArgs e)
    {
        var server = ServerInput.Text.Trim();
        var token = TokenInput.Text.Trim();
        if (server.Length == 0 || token.Length == 0)
        {
            ShowConnectMessage(Loc.T("connect.err.empty"), false);
            (server.Length == 0 ? ServerBox : TokenBox).BorderBrush = Brushes.IndianRed;
            return;
        }
        if (!Uri.TryCreate(server, UriKind.Absolute, out var uri) || (uri.Scheme != "http" && uri.Scheme != "https"))
        {
            ShowConnectMessage(Loc.T("connect.err.url"), false);
            ServerBox.BorderBrush = Brushes.IndianRed;
            return;
        }

        ConnectButton.IsEnabled = false;
        ConnectButton.Content = Loc.T("connect.checking");
        try
        {
            var options = new AgentOptions { Server = server, Token = token };
            using var api = new IngestApiClient(() => options, NullLogger.Instance, maxAttempts: 1, timeout: TimeSpan.FromSeconds(8));
            var (result, body) = await api.HeartbeatAsync(HostInfo.Heartbeat(), CancellationToken.None);
            if (!result.Ok)
            {
                ShowConnectMessage(Loc.Reason(result.Reason), false);
                if (result.Reason == ServerReason.Unauthorized) TokenBox.BorderBrush = Brushes.IndianRed;
                else ServerBox.BorderBrush = Brushes.IndianRed;
                return;
            }

            _connected = body;
            ShowConnectMessage(Loc.T("connect.ok", body?.ProjectName ?? "-", body?.AgentName ?? "-"), true);
            await Task.Delay(900);
            if (_connected is not null)
            {
                RenderLogs();
                Show(LogsPanel);
            }
        }
        finally
        {
            ConnectButton.IsEnabled = true;
            ConnectButton.Content = Loc.T("connect.button");
        }
    }

    private void ShowConnectMessage(string text, bool ok)
    {
        ConnectMessage.Text = text;
        ConnectMessage.Foreground = ok ? new SolidColorBrush(Color.FromRgb(0x15, 0x80, 0x3D)) : new SolidColorBrush(Color.FromRgb(0xD0, 0x3B, 0x3B));
        ConnectMessageBox.Background = ok ? new SolidColorBrush(Color.FromRgb(0xEA, 0xF8, 0xEF)) : new SolidColorBrush(Color.FromRgb(0xFD, 0xEE, 0xEE));
        ConnectMessageBox.Visibility = Visibility.Visible;
    }

    private void LogsBack_Click(object sender, RoutedEventArgs e) => Show(ConnectPanel);

    private void AddFolder_Click(object sender, RoutedEventArgs e)
    {
        using var dialog = new WinForms.FolderBrowserDialog
        {
            Description = Loc.T("logs.folderDialog"),
            UseDescriptionForTitle = true,
            ShowNewFolderButton = false,
        };
        if (dialog.ShowDialog() == WinForms.DialogResult.OK && !string.IsNullOrWhiteSpace(dialog.SelectedPath))
        {
            AddPath(Path.Combine(dialog.SelectedPath, "*.log"));
        }
    }

    private void AddPattern_Click(object sender, RoutedEventArgs e)
    {
        var text = PatternInput.Text.Trim().Trim('"');
        if (text.Length == 0)
        {
            return;
        }
        AddPath(Directory.Exists(text) ? Path.Combine(text, "*.log") : text);
        PatternInput.Text = string.Empty;
    }

    private void PatternInput_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            AddPattern_Click(sender, e);
        }
    }

    private void AddPath(string path)
    {
        if (!_logPaths.Contains(path, StringComparer.OrdinalIgnoreCase))
        {
            _logPaths.Add(path);
        }
        RenderLogs();
    }

    private void RenderLogs()
    {
        LogList.Children.Clear();
        foreach (var path in _logPaths)
        {
            LogList.Children.Add(LogRow(path));
        }
        LogEmpty.Visibility = _logPaths.Count == 0 ? Visibility.Visible : Visibility.Collapsed;

        SuggestPanel.Children.Clear();
        foreach (var folder in CandidateFolders.Where(Directory.Exists))
        {
            var pattern = Path.Combine(folder, "*.log");
            if (_logPaths.Contains(pattern, StringComparer.OrdinalIgnoreCase))
            {
                continue;
            }
            var chip = new Button { Style = (Style)FindResource("ChipButton"), Content = "+ " + folder };
            chip.Click += (_, _) => AddPath(pattern);
            SuggestPanel.Children.Add(chip);
        }
        SuggestGroup.Visibility = SuggestPanel.Children.Count > 0 ? Visibility.Visible : Visibility.Collapsed;
    }

    private UIElement LogRow(string path)
    {
        var count = LogTailer.Expand(path).Take(999).Count();
        var card = new Border
        {
            Background = (Brush)FindResource("Card"),
            CornerRadius = new CornerRadius(14),
            Padding = new Thickness(14, 12, 8, 12),
            Margin = new Thickness(0, 0, 0, 8),
        };
        var grid = new Grid();
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

        var icon = new System.Windows.Shapes.Path
        {
            Data = (Geometry)FindResource("IconFolder"),
            Fill = Accent,
            Width = 16,
            Height = 14,
            Stretch = Stretch.Uniform,
            VerticalAlignment = VerticalAlignment.Top,
            Margin = new Thickness(0, 2, 12, 0),
        };
        var text = new StackPanel();
        text.Children.Add(new TextBlock
        {
            Text = path,
            FontFamily = new FontFamily("Consolas"),
            FontSize = 12.5,
            Foreground = Ink,
            TextWrapping = TextWrapping.Wrap,
        });
        text.Children.Add(new TextBlock
        {
            Text = Loc.T("logs.files", count),
            FontSize = 12,
            Foreground = count > 0 ? Sub : Muted,
            Margin = new Thickness(0, 3, 0, 0),
        });
        Grid.SetColumn(text, 1);

        var remove = new Button { Style = (Style)FindResource("CloseButton"), Width = 30, Height = 30, VerticalAlignment = VerticalAlignment.Center };
        remove.Click += (_, _) =>
        {
            _logPaths.Remove(path);
            RenderLogs();
        };
        Grid.SetColumn(remove, 2);

        grid.Children.Add(icon);
        grid.Children.Add(text);
        grid.Children.Add(remove);
        card.Child = grid;
        return card;
    }

    private async void Install_Click(object sender, RoutedEventArgs e)
    {
        if (_running)
        {
            return;
        }
        _running = true;
        StepsPanel.Children.Clear();
        Show(ProgressPanel);
        try
        {
            await RunInstallAsync();
        }
        finally
        {
            _running = false;
        }
    }

    private async Task RunInstallAsync()
    {
        var options = new AgentOptions
        {
            Server = ServerInput.Text.Trim(),
            Token = TokenInput.Text.Trim(),
            Logs = _logPaths.Select(p => new LogSource { Path = p }).ToList(),
        };

        SetProgress(Loc.T("progress.install.title"), Loc.T("progress.install.status"));
        var temp = Path.Combine(Path.GetTempPath(), $"monitoring-agent-{Guid.NewGuid():N}.json");
        AgentConfigStore.Save(temp, options);

        var serviceInstalled = await Task.Run(() =>
        {
            var proc = Installer.StartElevatedInstall(temp);
            if (proc is null)
            {
                return false;
            }
            proc.WaitForExit();
            return Installer.IsServiceInstalled();
        });
        try { File.Delete(temp); }
        catch { }
        AddStep(serviceInstalled ? Loc.T("step.install.ok") : Loc.T("step.install.skip"));

        var configSaved = serviceInstalled && Installer.IsInstalled();
        if (!configSaved)
        {
            try
            {
                AgentConfigStore.Save(AgentPaths.ConfigFile, options);
                configSaved = true;
            }
            catch { }
        }
        AddStep(configSaved ? Loc.T("step.config") : Loc.T("step.config.fail"));

        SetProgress(Loc.T("progress.first.title"), options.ServerBase);
        var collector = new SystemMetricsCollector();
        await Task.Delay(800);
        var point = await Task.Run(collector.Collect);
        AddStep(Loc.T("step.metrics"));

        using var api = new IngestApiClient(() => options, NullLogger.Instance, maxAttempts: 1, timeout: TimeSpan.FromSeconds(8));
        var (heartbeat, body) = await api.HeartbeatAsync(HostInfo.Heartbeat(), CancellationToken.None);
        var sent = heartbeat.Ok && (await api.SendMetricsAsync(new[] { point }, CancellationToken.None)).Ok;
        AddStep(sent ? Loc.T("step.send.ok") : Loc.T("step.send.fail"));

        var background = EnsureBackgroundRunning(serviceInstalled);
        ShowResults(options, body ?? _connected, point, sent, serviceInstalled, background);
    }

    private static bool EnsureBackgroundRunning(bool serviceInstalled)
    {
        try
        {
            var exe = Installer.IsInstalled()
                ? Installer.InstalledAppExe
                : Environment.ProcessPath ?? Process.GetCurrentProcess().MainModule?.FileName;
            if (string.IsNullOrEmpty(exe))
            {
                return false;
            }
            AutostartManager.Enable(exe);
            Process.Start(new ProcessStartInfo
            {
                FileName = exe,
                Arguments = "--background --hint",
                UseShellExecute = false,
                CreateNoWindow = true,
            });
            return true;
        }
        catch
        {
            return serviceInstalled;
        }
    }

    private void SetProgress(string title, string status)
    {
        ProgressTitle.Text = title;
        ProgressStatus.Text = status;
    }

    private void AddStep(string text)
    {
        var row = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 6, 0, 6) };
        row.Children.Add(new System.Windows.Shapes.Path
        {
            Data = (Geometry)FindResource("IconCheck"),
            Stroke = Ink,
            StrokeThickness = 2,
            StrokeStartLineCap = PenLineCap.Round,
            StrokeEndLineCap = PenLineCap.Round,
            Width = 12,
            Height = 10,
            Stretch = Stretch.Uniform,
            VerticalAlignment = VerticalAlignment.Center,
            Margin = new Thickness(0, 0, 11, 0),
        });
        row.Children.Add(new TextBlock { Text = text, Foreground = Sub, FontSize = 14, TextWrapping = TextWrapping.Wrap, MaxWidth = 300 });
        StepsPanel.Children.Add(row);
    }

    private void ShowResults(AgentOptions options, HeartbeatResponse? body, MetricItem point, bool sent, bool service, bool background)
    {
        ResultsPanel.Children.Clear();
        var dash = Loc.T("val.dash");
        AddResultRow(Loc.T("row.project"), body?.ProjectName ?? dash);
        AddResultRow(Loc.T("row.agent"), body?.AgentName ?? dash);
        AddResultRow(Loc.T("row.hostname"), HostInfo.Hostname);
        AddResultRow(Loc.T("row.server"), options.ServerBase);
        AddResultRow(Loc.T("row.logs"), options.Logs.Count == 0 ? Loc.T("val.logs.none") : Loc.T("val.logs", options.Logs.Count));
        AddResultRow(Loc.T("row.metrics"), Loc.T("val.metrics", options.MetricsIntervalSeconds));
        AddResultRow(Loc.T("row.usage"), point.CpuPct is null ? dash : $"{point.CpuPct:0}% / {point.MemoryPct:0}%");
        AddResultRow(Loc.T("row.send"), sent ? Loc.T("val.send.ok") : Loc.T("val.send.fail"), !sent);
        AddResultRow(Loc.T("row.background"),
            service ? Loc.T("val.bg.service") : background ? Loc.T("val.bg.user") : Loc.T("val.bg.fail"),
            !service && !background);

        DoneSubtitle.Text = sent ? Loc.T("done.subtitle.ok") : Loc.T("done.subtitle.offline");
        Show(DonePanel);
    }

    private void AddResultRow(string label, string value, bool muted = false)
    {
        if (ResultsPanel.Children.Count > 0)
        {
            ResultsPanel.Children.Add(new Border { Height = 1, Background = Line });
        }
        var grid = new Grid { Margin = new Thickness(0, 12, 0, 12) };
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(96) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        var labelBlock = new TextBlock { Text = label, Foreground = Sub, FontSize = 13, VerticalAlignment = VerticalAlignment.Center };
        var valueBlock = new TextBlock
        {
            Text = value,
            Foreground = muted ? Muted : Ink,
            FontSize = 13,
            FontWeight = FontWeights.SemiBold,
            TextWrapping = TextWrapping.Wrap,
            TextAlignment = TextAlignment.Right,
            HorizontalAlignment = HorizontalAlignment.Right,
            VerticalAlignment = VerticalAlignment.Center,
        };
        Grid.SetColumn(valueBlock, 1);
        grid.Children.Add(labelBlock);
        grid.Children.Add(valueBlock);
        ResultsPanel.Children.Add(grid);
    }

    private void Header_MouseDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ChangedButton == MouseButton.Left)
        {
            DragMove();
        }
    }

    private void Close_Click(object sender, RoutedEventArgs e) => Close();
}
