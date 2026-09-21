using System.Windows;
using MonitoringAgent.Worker.Services;

namespace MonitoringAgent.App;

public partial class UninstallWindow : Window
{
    public UninstallWindow()
    {
        InitializeComponent();
        UninstallTitle.Text = Loc.T("uninstall.title");
        UninstallSubtitle.Text = Loc.T("uninstall.subtitle");
        DeleteButton.Content = Loc.T("uninstall.delete");
        CancelButton.Content = Loc.T("uninstall.cancel");
    }

    private async void Delete_Click(object sender, RoutedEventArgs e)
    {
        ErrorText.Visibility = Visibility.Collapsed;
        DeleteButton.IsEnabled = false;
        CancelButton.IsEnabled = false;
        DeleteButton.Content = Loc.T("uninstall.deleting");

        try { AutostartManager.Disable(); }
        catch { }

        var ok = await Task.Run(() =>
        {
            var proc = Installer.StartElevatedUninstall();
            if (proc is null)
            {
                return false;
            }
            proc.WaitForExit();
            return true;
        });

        if (!ok)
        {
            ErrorText.Text = Loc.T("uninstall.err.uac");
            ErrorText.Visibility = Visibility.Visible;
            DeleteButton.Content = Loc.T("uninstall.delete");
            DeleteButton.IsEnabled = true;
            CancelButton.IsEnabled = true;
            return;
        }

        MessageBox.Show(Loc.T("uninstall.done"), Loc.T("app.name"), MessageBoxButton.OK, MessageBoxImage.Information);
        Application.Current.Shutdown();
    }

    private void Cancel_Click(object sender, RoutedEventArgs e) => Application.Current.Shutdown();
}
