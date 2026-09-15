# Allow games-mobile (port 5180) through Windows Firewall for phone/emulator access.
$port = 5180
$ruleName = "games-mobile dev $port"

$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Firewall rule '$ruleName' already exists."
} else {
  New-NetFirewallRule -DisplayName $ruleName `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort $port `
    -Profile Private,Domain `
    | Out-Null
  Write-Host "Added firewall rule '$ruleName' for TCP $port (Private/Domain networks)."
}

Write-Host "games-mobile should be reachable at http://192.168.100.75:$port/ from your phone."
Write-Host "Emulator uses http://10.0.2.2:$port/"
