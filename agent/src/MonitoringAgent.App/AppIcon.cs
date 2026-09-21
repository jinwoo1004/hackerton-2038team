using Drawing = System.Drawing;

namespace MonitoringAgent.App;

internal static class AppIcon
{
    public static Drawing.Icon Load()
    {
        try
        {
            using var stream = typeof(AppIcon).Assembly.GetManifestResourceStream("logo_app.ico");
            if (stream is not null)
            {
                return new Drawing.Icon(stream);
            }
        }
        catch { }

        try
        {
            var path = Environment.ProcessPath;
            if (!string.IsNullOrEmpty(path))
            {
                var icon = Drawing.Icon.ExtractAssociatedIcon(path);
                if (icon is not null)
                {
                    return icon;
                }
            }
        }
        catch { }

        return Drawing.SystemIcons.Application;
    }
}
