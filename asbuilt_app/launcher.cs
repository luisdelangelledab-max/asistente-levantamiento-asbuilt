using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

namespace CodexAsBuiltLauncher
{
    static class Program
    {
        private const int PORT = 3120;
        private static readonly string Url = "http://localhost:" + PORT;

        [STAThread]
        static void Main(string[] args)
        {
            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            Directory.SetCurrentDirectory(appDir);

            bool headlesCheckOnly = (args.Length > 0 && args[0] == "--verify-start");

            if (!IsPortListening(PORT))
            {
                StartBackendServer(appDir);
                for (int i = 0; i < 40; i++)
                {
                    if (IsPortListening(PORT)) break;
                    Thread.Sleep(200);
                }
            }

            if (headlesCheckOnly)
            {
                Console.WriteLine("EXE_BACKEND_READY:" + Url);
                return;
            }

            OpenApplicationWindow(Url);
        }

        static bool IsPortListening(int port)
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    var result = client.BeginConnect("127.0.0.1", port, null, null);
                    bool success = result.AsyncWaitHandle.WaitOne(TimeSpan.FromMilliseconds(250));
                    if (!success) return false;
                    client.EndConnect(result);
                    return true;
                }
            }
            catch
            {
                return false;
            }
        }

        static void StartBackendServer(string appDir)
        {
            string serverPy = Path.Combine(appDir, "server.py");
            if (!File.Exists(serverPy))
            {
                MessageBox.Show("No se encontró server.py en: " + appDir, "Error AS-BUILT", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = "python";
            psi.Arguments = "\"" + serverPy + "\"";
            psi.WorkingDirectory = appDir;
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            psi.WindowStyle = ProcessWindowStyle.Hidden;

            try
            {
                Process.Start(psi);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error al iniciar Python server.py: " + ex.Message, "Error AS-BUILT", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        static void OpenApplicationWindow(string url)
        {
            string[] edgePaths = new string[]
            {
                @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                @"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                @"C:\Program Files\Google\Chrome\Application\chrome.exe"
            };

            foreach (string browser in edgePaths)
            {
                if (File.Exists(browser))
                {
                    try
                    {
                        ProcessStartInfo bPsi = new ProcessStartInfo();
                        bPsi.FileName = browser;
                        bPsi.Arguments = "--app=" + url + " --window-size=1440,900";
                        bPsi.UseShellExecute = true;
                        Process.Start(bPsi);
                        return;
                    }
                    catch { }
                }
            }

            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }
    }
}
