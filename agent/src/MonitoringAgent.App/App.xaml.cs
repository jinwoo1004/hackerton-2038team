using System.Threading;
using System.Windows;
using System.Windows.Threading;
using MonitoringAgent.Worker.Services;

namespace MonitoringAgent.App;

public partial class App : Application
{
    private const string UiInstanceName = "MonitoringAgent_UI_Instance";
    private const string UiActivateEventName = "MonitoringAgent_UI_Activate";
    private const string TrayInstanceName = "MonitoringAgent_Tray_Instance";

    private Mutex? _uiMutex;
    private Mutex? _trayMutex;
    private EventWaitHandle? _uiActivateEvent;
    private MainWindow? _mainWindow;
    private IDisposable? _collectorLock;
    private CancellationTokenSource? _backgroundCts;
    private TrayIconService? _tray;

    public App()
    {
        DispatcherUnhandledException += OnDispatcherUnhandledException;
    }

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        Loc.LoadSaved();

        if (HasArg(e.Args, "--install"))
        {
            RunElevated(() => Installer.RunInstall(ArgValue(e.Args, "--config")));
        }
        else if (HasArg(e.Args, "--uninstall-confirmed"))
        {
            RunElevated(Installer.RunUninstall);
        }
        else if (HasArg(e.Args, "--uninstall"))
        {
            ShutdownMode = ShutdownMode.OnExplicitShutdown;
            new UninstallWindow().Show();
        }
        else if (HasArg(e.Args, "--background"))
        {
            StartBackground(HasArg(e.Args, "--hint"));
        }
        else
        {
            if (!EnsureSingleUiInstance())
            {
                return;
            }
            _mainWindow = new MainWindow();
            _mainWindow.Show();
        }
    }

    private void RunElevated(Action action)
    {
        ShutdownMode = ShutdownMode.OnExplicitShutdown;
        Task.Run(() =>
        {
            try { action(); }
            catch { }
        }).ContinueWith(_ => Dispatcher.Invoke(Shutdown));
    }

    private bool EnsureSingleUiInstance()
    {
        _uiMutex = new Mutex(initiallyOwned: true, UiInstanceName, out var createdNew);
        if (!createdNew)
        {
            try
            {
                if (EventWaitHandle.TryOpenExisting(UiActivateEventName, out var ev))
                {
                    ev.Set();
                    ev.Dispose();
                }
            }
            catch { }
            Shutdown();
            return false;
        }

        _uiActivateEvent = new EventWaitHandle(false, EventResetMode.AutoReset, UiActivateEventName);
        var listener = new Thread(() =>
        {
            while (true)
            {
                try
                {
                    _uiActivateEvent.WaitOne();
                    Dispatcher.Invoke(BringMainWindowToFront);
                }
                catch
                {
                    break;
                }
            }
        })
        {
            IsBackground = true,
            Name = "UiActivateListener",
        };
        listener.Start();

        Exit += (_, _) =>
        {
            try { _uiActivateEvent?.Dispose(); } catch { }
            try { _uiMutex?.Dispose(); } catch { }
        };
        return true;
    }

    private void BringMainWindowToFront()
    {
        if (_mainWindow is null)
        {
            return;
        }
        if (_mainWindow.WindowState == WindowState.Minimized)
        {
            _mainWindow.WindowState = WindowState.Normal;
        }
        _mainWindow.Show();
        _mainWindow.Activate();
        _mainWindow.Topmost = true;
        _mainWindow.Topmost = false;
        _mainWindow.Focus();
    }

    private void StartBackground(bool showHint)
    {
        _trayMutex = new Mutex(initiallyOwned: true, TrayInstanceName, out var createdNew);
        if (!createdNew)
        {
            Shutdown();
            return;
        }

        ShutdownMode = ShutdownMode.OnExplicitShutdown;
        _backgroundCts = new CancellationTokenSource();
        Exit += (_, _) =>
        {
            try { _backgroundCts.Cancel(); } catch { }
            _tray?.Dispose();
            _collectorLock?.Dispose();
            try { _trayMutex?.Dispose(); } catch { }
        };

        // 서비스가 이미 수집 중이면 트레이는 상태만 보여준다
        _collectorLock = SingleInstanceGuard.TryAcquire();
        if (_collectorLock is not null)
        {
            _ = BackgroundAgent.RunAsync(_backgroundCts.Token);
        }

        _tray = new TrayIconService();
        if (showHint)
        {
            _tray.ShowHint();
        }
    }

    private static bool HasArg(string[] args, string name) =>
        args.Any(a => string.Equals(a, name, StringComparison.OrdinalIgnoreCase));

    private static string? ArgValue(string[] args, string name)
    {
        var i = Array.FindIndex(args, a => string.Equals(a, name, StringComparison.OrdinalIgnoreCase));
        return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
    }

    private void OnDispatcherUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
    {
        MessageBox.Show(Loc.T("error.unexpected") + "\n\n" + e.Exception.Message, Loc.T("app.name"),
            MessageBoxButton.OK, MessageBoxImage.Warning);
        e.Handled = true;
    }
}
