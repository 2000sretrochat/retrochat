// Windows default recording device volume via Core Audio (IAudioEndpointVolume), using an inline C# Add-Type script in PowerShell. No third-party downloads.
const { execFile } = require('child_process');
const CS = `
using System; using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume { int f(); int g(); int h(); int i(); int SetMasterVolumeLevelScalar(float l, Guid ctx); int j(); int GetMasterVolumeLevelScalar(out float l); }
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref Guid id, int ctx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o); }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice d); }
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDE {}
public static class YcMic {
  static IAudioEndpointVolume V() { var e = (IMMDeviceEnumerator)(new MMDE()); IMMDevice d; Marshal.ThrowExceptionForHR(e.GetDefaultAudioEndpoint(1, 0, out d)); var iid = typeof(IAudioEndpointVolume).GUID; object o; Marshal.ThrowExceptionForHR(d.Activate(ref iid, 23, IntPtr.Zero, out o)); return (IAudioEndpointVolume)o; }
  public static int Get() { float l; Marshal.ThrowExceptionForHR(V().GetMasterVolumeLevelScalar(out l)); return (int)Math.Round(l * 100); }
  public static int Step(int d) { var v = V(); float l; v.GetMasterVolumeLevelScalar(out l); int n = Math.Max(0, Math.Min(100, (int)Math.Round(l * 100 / 5.0) * 5 + d)); Marshal.ThrowExceptionForHR(v.SetMasterVolumeLevelScalar(n / 100f, Guid.Empty)); return n; }
}`;
function run(delta) {
  return new Promise((res, rej) => {
    if (process.platform !== 'win32') return rej(new Error('Windows only'));
    const d = Math.max(-100, Math.min(100, parseInt(delta, 10) || 0));
    const ps = `$ErrorActionPreference='Stop'; Add-Type -TypeDefinition @'\n${CS}\n'@; ${d ? `[YcMic]::Step(${d})` : '[YcMic]::Get()'}`;
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps], { windowsHide: true, timeout: 15000 }, (e, out) => {
      if (e) return rej(e); const n = parseInt(String(out).trim().split(/\s+/).pop(), 10); Number.isFinite(n) ? res(n) : rej(new Error('bad output')); });
  });
}
module.exports = { get: () => run(0), step: d => run(d) };
