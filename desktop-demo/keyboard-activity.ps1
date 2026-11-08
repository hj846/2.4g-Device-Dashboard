param([int]$OwnerPid)
$ErrorActionPreference = 'Stop'
Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

public sealed class KeyboardActivity : NativeWindow {
    [StructLayout(LayoutKind.Sequential)]
    struct Registration { public ushort Page, Usage; public uint Flags; public IntPtr Target; }
    [StructLayout(LayoutKind.Sequential)]
    struct Header { public uint Type, Size; public IntPtr Device, Param; }
    [DllImport("user32.dll", SetLastError=true)]
    static extern bool RegisterRawInputDevices(Registration[] items, uint count, uint size);
    [DllImport("user32.dll")]
    static extern uint GetRawInputData(IntPtr input, uint command, out Header header, ref uint size, uint headerSize);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)]
    static extern uint GetRawInputDeviceInfo(IntPtr device, uint command, StringBuilder name, ref uint length);
    readonly System.Collections.Generic.Dictionary<IntPtr,string> names = new System.Collections.Generic.Dictionary<IntPtr,string>();
    readonly System.Collections.Generic.Dictionary<IntPtr,long> reported = new System.Collections.Generic.Dictionary<IntPtr,long>();
    readonly System.Diagnostics.Stopwatch clock = System.Diagnostics.Stopwatch.StartNew();

    protected override void WndProc(ref Message message) {
        if (message.Msg == 0x00FE) { // WM_INPUT_DEVICE_CHANGE: handles can be reused after removal.
            names.Remove(message.LParam);
            reported.Remove(message.LParam);
            Console.WriteLine("DEVICES_CHANGED");
        }
        if (message.Msg == 0x00FF) {
            Header h;
            uint size = (uint)Marshal.SizeOf(typeof(Header));
            // RID_HEADER exposes only the source device. Never request the keyboard payload.
            if (GetRawInputData(message.LParam, 0x10000005, out h, ref size, size) == size && h.Type <= 1) {
                string name;
                if (!names.TryGetValue(h.Device, out name)) {
                    uint length = 0;
                    GetRawInputDeviceInfo(h.Device, 0x20000007, null, ref length);
                    var buffer = new StringBuilder((int)Math.Min(length + 1, 4096u));
                    length = (uint)buffer.Capacity;
                    uint result = GetRawInputDeviceInfo(h.Device, 0x20000007, buffer, ref length);
                    name = result == uint.MaxValue ? "" : buffer.ToString();
                    names[h.Device] = name;
                }
                long last;
                bool tracked = h.Type == 1 ? (name.IndexOf("VID_3554&PID_FA09", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                             name.IndexOf("VID_3837&PID_1015", StringComparison.OrdinalIgnoreCase) >= 0)
                                           : name.IndexOf("VID_1532&PID_0083", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                             name.IndexOf("VID_24AE&PID_1464", StringComparison.OrdinalIgnoreCase) >= 0;
                if (tracked &&
                    (!reported.TryGetValue(h.Device, out last) || clock.ElapsedMilliseconds-last >= 5000)) {
                    reported[h.Device] = clock.ElapsedMilliseconds;
                    Console.WriteLine(name);
                }
            }
        }
        base.WndProc(ref message);
    }

    public static void Run(int owner) {
        var window = new KeyboardActivity();
        window.CreateHandle(new CreateParams { Parent = new IntPtr(-3) });
        var items = new[] {
            new Registration { Page=1, Usage=6, Flags=0x2100, Target=window.Handle },
            new Registration { Page=1, Usage=2, Flags=0x2100, Target=window.Handle }
        };
        if (!RegisterRawInputDevices(items,(uint)items.Length,(uint)Marshal.SizeOf(typeof(Registration)))) throw new Win32Exception();
        using (var timer = new Timer { Interval=5000 }) {
            timer.Tick += delegate {
                try { using (var p=System.Diagnostics.Process.GetProcessById(owner)) { if(p.HasExited) Application.ExitThread(); } }
                catch (ArgumentException) { Application.ExitThread(); }
            };
            timer.Start();
            Console.WriteLine("READY");
            Application.Run();
        }
        window.DestroyHandle();
    }
}
"@
[KeyboardActivity]::Run($OwnerPid)
