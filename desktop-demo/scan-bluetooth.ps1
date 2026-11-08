param([switch]$ProgressFrames)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$warnings = @()
try {
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -TypeDefinition 'public static class NexusWinRT { public static object Prop(object map, string key) { object result; return ((System.Collections.Generic.IReadOnlyDictionary<string,object>)map).TryGetValue(key, out result) ? result : null; } public static object[] Items(object value) { var items = new System.Collections.Generic.List<object>(); foreach(object item in (System.Collections.IEnumerable)value) { if(item is System.Collections.IEnumerable && !(item is string)) items.AddRange(Items(item)); else items.Add(item); } return items.ToArray(); } }'
$null = [Windows.Devices.Enumeration.DeviceInformation, Windows.Devices.Enumeration, ContentType=WindowsRuntime]
$null = [Windows.Devices.Enumeration.DeviceInformationCollection, Windows.Devices.Enumeration, ContentType=WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
$properties = [string[]]@('System.Devices.Aep.IsPaired','System.Devices.Aep.IsConnected','System.Devices.Aep.SignalStrength','System.Devices.Aep.DeviceAddress')
# Use Windows' paired-device selectors, which query known endpoints without radio inquiry.
$selectors = @(
    [Windows.Devices.Bluetooth.BluetoothDevice,Windows.Devices.Bluetooth,ContentType=WindowsRuntime]::GetDeviceSelectorFromPairingState($true)
    [Windows.Devices.Bluetooth.BluetoothLEDevice,Windows.Devices.Bluetooth,ContentType=WindowsRuntime]::GetDeviceSelectorFromPairingState($true)
)
$bt = foreach ($selector in $selectors) {
    $operation = [Windows.Devices.Enumeration.DeviceInformation]::FindAllAsync($selector, $properties)
    $task = $asTask.MakeGenericMethod([Windows.Devices.Enumeration.DeviceInformationCollection]).Invoke($null, @($operation))
    if (-not $task.Wait(12000)) { throw 'Bluetooth enumeration timed out' }
    [NexusWinRT]::Items($task.Result)
}
} catch { $bt = @(); $warnings += "蓝牙扫描暂不可用" }

$addresses = @{}
$result = [Collections.Generic.List[object]]::new()
foreach ($d in $bt) {
    if ([NexusWinRT]::Prop($d.Properties, 'System.Devices.Aep.IsPaired') -eq $false) { continue }
    if ($d.Name -isnot [string] -or $d.Id -isnot [string]) { $warnings += "蓝牙设备信息格式暂不支持"; continue }
    $connected = [NexusWinRT]::Prop($d.Properties, 'System.Devices.Aep.IsConnected') -eq $true
    $battery = $null
    $address = ([string][NexusWinRT]::Prop($d.Properties, 'System.Devices.Aep.DeviceAddress') -replace ':','').ToUpperInvariant()
    if ($connected -and $address) { $addresses[$d.Id] = $address }
    $result.Add([pscustomobject]@{id=$d.Id; model=$d.Name; brand='Bluetooth'; kind='蓝牙设备'; connected=$connected; connection='蓝牙'; battery=$(if($connected){$battery}else{$null}); rssi=$(if($connected){[NexusWinRT]::Prop($d.Properties, 'System.Devices.Aep.SignalStrength')}else{$null}); source='Windows Bluetooth'})
}

if ($ProgressFrames) {
    ConvertTo-Json -InputObject @{ preview=@($result.ToArray()) } -Depth 4 -Compress
}
if ($addresses.Count) {
    $pnp = @(Get-PnpDevice -PresentOnly)
    foreach ($row in $result) {
        $address = $addresses[$row.id]
        if (-not $address) { continue }
        $ids = @($pnp | Where-Object { $_.InstanceId -like "*$address*" } | ForEach-Object InstanceId)
        if (-not $ids.Count) { continue }
        foreach ($value in @(Get-PnpDeviceProperty -InstanceId $ids -KeyName '{104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2' -ErrorAction SilentlyContinue)) {
            if ($value.Type -ne 'Empty' -and $value.Data -is [ValueType] -and $value.Data -ge 0 -and $value.Data -le 100) { $row.battery=$value.Data; break }
        }
    }
}
ConvertTo-Json -InputObject @{ devices=@($result.ToArray()); warnings=$warnings } -Depth 4 -Compress
