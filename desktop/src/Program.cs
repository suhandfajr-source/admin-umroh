using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace AdminUmrohApp
{
    static class Program
    {
        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        private const int SW_RESTORE = 9;

        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string targetUrl = "https://admin-umroh-app.vercel.app/";

            // Check config.json if exists next to exe
            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            string configFile = Path.Combine(appDir, "config.json");
            if (File.Exists(configFile))
            {
                try
                {
                    string content = File.ReadAllText(configFile);
                    int urlIdx = content.IndexOf("\"url\":");
                    if (urlIdx != -1)
                    {
                        int startQuote = content.IndexOf('"', urlIdx + 6);
                        if (startQuote != -1)
                        {
                            int endQuote = content.IndexOf('"', startQuote + 1);
                            if (endQuote != -1)
                            {
                                string customUrl = content.Substring(startQuote + 1, endQuote - startQuote - 1).Trim();
                                if (!string.IsNullOrEmpty(customUrl))
                                {
                                    targetUrl = customUrl;
                                }
                            }
                        }
                    }
                }
                catch { }
            }

            // Dedicated data directory in LocalAppData
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string profileDir = Path.Combine(localAppData, "AdminUmrohApp", "Profile");
            if (!Directory.Exists(profileDir))
            {
                Directory.CreateDirectory(profileDir);
            }

            // Find Microsoft Edge executable
            string edgePath = GetEdgeExecutablePath();
            if (string.IsNullOrEmpty(edgePath) || !File.Exists(edgePath))
            {
                // Fallback to default browser
                Process.Start(new ProcessStartInfo
                {
                    FileName = targetUrl,
                    UseShellExecute = true
                });
                return;
            }

            // Edge App Mode launch arguments
            string arguments = string.Format(
                "--app=\"{0}\" --user-data-dir=\"{1}\" --window-size=1366,820 --enable-features=msEdgeSeamlessWindowBackdrop --no-first-run --no-default-browser-check",
                targetUrl,
                profileDir
            );

            try
            {
                Process process = new Process();
                process.StartInfo.FileName = edgePath;
                process.StartInfo.Arguments = arguments;
                process.StartInfo.UseShellExecute = false;
                process.Start();
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Gagal membuka aplikasi Admin Umroh:\n" + ex.Message,
                    "Error Admin Umroh",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }

        private static string GetEdgeExecutablePath()
        {
            string[] possiblePaths = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Microsoft\Edge\Application\msedge.exe")
            };

            foreach (string path in possiblePaths)
            {
                if (File.Exists(path))
                {
                    return path;
                }
            }

            return null;
        }
    }
}
