using System.Windows;
using WinForms = System.Windows.Forms;

namespace MonitoringAgent.App;

public sealed class TrayIconService : IDisposable
{
    private readonly WinForms.NotifyIcon _notifyIcon;
    private TrayStatusWindow? _window;

    public TrayIconService()
    {
        _notifyIcon = new WinForms.NotifyIcon
        {
            Text = Loc.T("tray.tooltip"),
            Visible = true,
            Icon = AppIcon.Load(),
        };
        _notifyIcon.MouseClick += (_, _) => TogglePopup();
    }

    public void ShowHint()
    {
        _notifyIcon.BalloonTipTitle = Loc.T("app.name");
        _notifyIcon.BalloonTipText = Loc.T("tray.hint");
        _notifyIcon.ShowBalloonTip(3000);
    }

    private void TogglePopup()
    {
        if (_window is { IsVisible: true })
        {
            _window.Hide();
            return;
        }

        _window ??= new TrayStatusWindow();
        _window.Show();
        _window.UpdateLayout();

        var area = SystemParameters.WorkArea;
        _window.Left = area.Right - _window.ActualWidth - 4;
        _window.Top = area.Bottom - _window.ActualHeight - 4;
        _window.Activate();
        _window.Topmost = true;
    }

    public void Dispose()
    {
        _notifyIcon.Visible = false;
        _notifyIcon.Dispose();
        _window?.Close();
    }
}
