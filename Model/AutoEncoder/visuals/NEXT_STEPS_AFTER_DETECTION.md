# Next Steps After Obtaining Malicious Process Detection Results

## Overview

After running the anomaly detection pipeline and obtaining the `new_test_results.csv` file containing detected malicious processes, this guide outlines the critical next steps for cyber incident response and threat mitigation.

## Generated Output Files

The pipeline produces several key files for analysis:

- **`new_test_results.csv`** - Complete detection results with all process details
- **`detected_anomalies.csv`** - All flagged anomalies with priority levels
- **`critical_anomalies_top100.csv`** - Top 100 most critical threats
- **`full_results.csv`** - Full dataset including benign processes
- **`executive_dashboard.png`** - Visual summary for stakeholders
- **`confusion_matrix.png`**, **`roc_curve.png`**, **`priority_distribution.png`** - Performance metrics

---

## Phase 1: Initial Review & Validation (15-30 minutes)

### 1.1 Quick Assessment
```bash
# Count total detections by priority
csvcut -c priority new_test_results.csv | sort | uniq -c

# View top 20 critical anomalies
head -21 critical_anomalies_top100.csv
```

**Key Questions:**
- How many CRITICAL vs HIGH priority detections?
- What hosts are affected (check `hostName` column)?
- What processes are flagged (check `processName` column)?
- What is the reconstruction error range?

### 1.2 Validate Detection Quality
- Review the `actual_evil` column to see ground truth labels
- Check `executive_dashboard.png` for F1 score, TPR, FPR metrics
- Identify potential false positives (high reconstruction error but `actual_evil=0`)

**Red Flags to Watch For:**
- Processes with names: `tsm`, `bash`, `tar`, unusual system binaries
- Suspicious events: `clone`, `socket`, `connect`, `prctl`
- Network connections to unusual IPs (check `args` field for socket/connect events)
- File operations in `/tmp` or hidden directories

---

## Phase 2: Cyber Triage & Prioritization (30-60 minutes)

### 2.1 Prioritize by Severity

**CRITICAL Priority** (Investigate FIRST):
- Highest reconstruction errors (most anomalous behavior)
- Network-related system calls (`socket`, `connect`)
- Process manipulation (`clone`, `prctl`)
- Privilege escalation attempts (`cap_capable`)

**HIGH Priority** (Investigate SECOND):
- Suspicious file access patterns
- Unusual parent-child process relationships
- DNS queries to unknown domains

**MEDIUM/LOW Priority** (Investigate LAST):
- Lower reconstruction errors
- May be legitimate but unusual behavior

### 2.2 Group by Attack Indicators

Create pivot tables to identify patterns:

```python
import pandas as pd

df = pd.read_csv('new_test_results.csv')

# Group by host to identify compromised systems
host_summary = df.groupby('hostName').agg({
    'processId': 'nunique',
    'priority': lambda x: (x == 'CRITICAL').sum(),
    'reconstruction_error': 'mean'
}).sort_values('priority', ascending=False)

# Group by process name to identify malicious binaries
process_summary = df.groupby('processName').agg({
    'processId': 'count',
    'reconstruction_error': 'mean'
}).sort_values('reconstruction_error', ascending=False)

# Group by event type to understand attack techniques
event_summary = df.groupby('eventName')['processId'].count().sort_values(ascending=False)
```

### 2.3 Identify Attack Patterns

Look for common attack indicators:

| Pattern | What to Look For | Risk Level |
|---------|-----------------|------------|
| **Network Scanning** | Multiple `socket` + `connect` calls to different IPs | HIGH |
| **Process Injection** | `clone` with `CLONE_VM` + `CLONE_THREAD` flags | CRITICAL |
| **Data Exfiltration** | File reads followed by network connections | CRITICAL |
| **Persistence** | Writes to `/tmp`, cron jobs, startup scripts | HIGH |
| **Privilege Escalation** | `cap_capable`, `setuid`, `prctl` calls | CRITICAL |

---

## Phase 3: Deep Investigation (1-4 hours)

### 3.1 Analyze Top CRITICAL Anomalies

For each CRITICAL detection, investigate:

**Process Context:**
```python
# For a specific processId (e.g., 7555 from the sample)
process_trace = df[df['processId'] == 7555].sort_values('timestamp')

# Examine:
print(f"Process: {process_trace['processName'].iloc[0]}")
print(f"Parent: {process_trace['parentProcessId'].iloc[0]}")
print(f"Host: {process_trace['hostName'].iloc[0]}")
print(f"Event sequence:\n{process_trace[['timestamp', 'eventName', 'args']]}")
```

**Network Activity:**
```python
# Extract network connections
network_events = df[df['eventName'].isin(['socket', 'connect', 'bind'])]

# Parse args to extract IPs and ports
import json
for idx, row in network_events.iterrows():
    args = eval(row['args'])
    for arg in args:
        if 'sin_addr' in str(arg):
            print(f"Connection: {arg}")
```

**File System Activity:**
```python
# Track file operations
file_events = df[df['eventName'].isin(['security_file_open', 'openat', 'stat', 'access'])]

# Check for suspicious paths
suspicious_paths = file_events[
    file_events['args'].str.contains('/tmp|/dev/shm|/var/tmp', na=False)
]
```

### 3.2 Reconstruct Attack Timeline

Create a chronological sequence of events:

1. **Initial Access** - How did the attacker gain entry?
   - SSH connections, vulnerable services?

2. **Execution** - What did they run?
   - Unusual processes, scripts, binaries

3. **Persistence** - How are they maintaining access?
   - Cron jobs, startup scripts, backdoors

4. **Privilege Escalation** - Did they gain elevated privileges?
   - `sudo`, `setuid`, capability operations

5. **Lateral Movement** - Are they spreading?
   - SSH to other hosts, network scanning

6. **Data Access** - What data did they touch?
   - File reads, database queries

7. **Exfiltration** - Did they steal data?
   - Large file transfers, network uploads

### 3.3 Correlate with External Intelligence

- Check IP addresses against threat intelligence feeds
- Search process hashes on VirusTotal
- Look up known malware signatures
- Check MITRE ATT&CK framework for matching TTPs

---

## Phase 4: Threat Classification & Impact Assessment (30-60 minutes)

### 4.1 Classify the Threat

| Type | Indicators | Response Priority |
|------|-----------|------------------|
| **Malware** | Unknown binaries, packed executables | CRITICAL |
| **APT Activity** | Stealthy, targeted, persistent | CRITICAL |
| **Insider Threat** | Access during unusual hours, data theft | HIGH |
| **Compromised Account** | Unusual login patterns, privilege abuse | HIGH |
| **Misconfiguration** | Legitimate but risky behavior | MEDIUM |
| **False Positive** | Benign but unusual activity | LOW |

### 4.2 Assess Impact

**Data Impact:**
- What data was accessed/modified/exfiltrated?
- Does it contain PII, financial data, IP, credentials?

**System Impact:**
- Which systems are compromised?
- Are critical services affected?
- Is production impacted?

**Business Impact:**
- Regulatory compliance violations?
- Customer trust implications?
- Financial losses?

### 4.3 Determine Scope

```python
# Find all related processes
affected_hosts = df[df['priority'] == 'CRITICAL']['hostName'].unique()
affected_users = df[df['priority'] == 'CRITICAL']['userId'].unique()
affected_processes = df[df['priority'] == 'CRITICAL']['processName'].unique()

print(f"Affected hosts: {len(affected_hosts)}")
print(f"Affected users: {len(affected_users)}")
print(f"Malicious processes: {list(affected_processes)}")
```

---

## Phase 5: Containment & Response (1-4 hours)

### 5.1 Immediate Containment

**For CRITICAL threats:**

1. **Isolate affected systems:**
   ```bash
   # Block network access (example)
   sudo iptables -A INPUT -s <compromised_ip> -j DROP
   sudo iptables -A OUTPUT -d <compromised_ip> -j DROP
   ```

2. **Kill malicious processes:**
   ```bash
   # Get processIds from CSV
   kill -9 <malicious_pid>
   ```

3. **Disable compromised accounts:**
   ```bash
   sudo passwd -l <username>
   sudo usermod -L <username>
   ```

4. **Block malicious IPs at firewall level**

### 5.2 Evidence Collection

**BEFORE removing malware, collect evidence:**

```bash
# Capture process memory
sudo gcore <pid>

# Capture network connections
sudo netstat -antup > netstat_capture.txt

# Capture running processes
ps auxf > process_tree.txt

# Copy suspicious files (with hashes)
md5sum /path/to/suspicious/file > evidence_hashes.txt
cp -p /path/to/suspicious/file /evidence/location/
```

### 5.3 Eradication

1. **Remove malicious files**
2. **Terminate backdoors**
3. **Reset compromised credentials**
4. **Patch vulnerabilities**
5. **Update security rules**

### 5.4 Recovery

1. **Restore systems from clean backups**
2. **Rebuild compromised hosts**
3. **Verify system integrity**
4. **Monitor for re-infection**

---

## Phase 6: Documentation & Reporting (1-2 hours)

### 6.1 Incident Report Template

Create a comprehensive incident report:

```markdown
# Security Incident Report

## Executive Summary
- **Incident Type:** [e.g., Malware infection, Data breach]
- **Severity:** [CRITICAL/HIGH/MEDIUM/LOW]
- **Detection Date:** [Date/Time]
- **Systems Affected:** [List hosts]
- **Status:** [Contained/Eradicated/Monitoring]

## Timeline of Events
- [Timestamp]: Initial detection
- [Timestamp]: Investigation began
- [Timestamp]: Containment actions
- [Timestamp]: Eradication complete

## Technical Details
- **Malicious Processes:** [List from CSV]
- **Attack Vectors:** [How they got in]
- **TTPs Used:** [MITRE ATT&CK IDs]
- **Indicators of Compromise (IoCs):**
  - IPs: [List]
  - Domains: [List]
  - File Hashes: [List]
  - Process Names: [List]

## Impact Assessment
- **Data Impact:** [What data was affected]
- **System Impact:** [What systems were compromised]
- **Business Impact:** [Financial, reputational, regulatory]

## Response Actions Taken
1. [Action 1]
2. [Action 2]
...

## Lessons Learned
- **What Worked Well:**
- **What Could Be Improved:**
- **Recommendations:**

## Follow-up Actions
- [ ] Action item 1
- [ ] Action item 2
```

### 6.2 Share Indicators of Compromise (IoCs)

Extract IoCs for sharing with security team:

```python
# Extract unique IPs from network events
import json
import re

iocs = {
    'ips': set(),
    'domains': set(),
    'processes': set(),
    'file_paths': set()
}

for idx, row in df[df['priority'].isin(['CRITICAL', 'HIGH'])].iterrows():
    # Extract IPs from args
    if 'sin_addr' in str(row['args']):
        ips = re.findall(r'\d+\.\d+\.\d+\.\d+', str(row['args']))
        iocs['ips'].update(ips)

    # Add malicious processes
    iocs['processes'].add(row['processName'])

# Export IoCs
with open('iocs.json', 'w') as f:
    json.dump({k: list(v) for k, v in iocs.items()}, f, indent=2)
```

### 6.3 Update Security Controls

Document recommended updates:

- **Firewall rules** - Block identified malicious IPs
- **IDS/IPS signatures** - Add detection for observed patterns
- **SIEM alerts** - Create alerts for similar behavior
- **Endpoint policies** - Restrict suspicious process execution

---

## Phase 7: Post-Incident Activities (Ongoing)

### 7.1 Continuous Monitoring

Set up monitoring for re-infection:

```python
# Create a watchlist of IoCs
watchlist = {
    'processes': ['tsm', 'suspicious_binary'],
    'ips': ['192.168.11.196'],
    'file_paths': ['/tmp/.X25-unix']
}

# Monitor new system call logs
def check_for_reinfection(new_logs):
    alerts = []
    for log in new_logs:
        if log['processName'] in watchlist['processes']:
            alerts.append(f"Watchlist process detected: {log}")
    return alerts
```

### 7.2 Threat Hunting

Proactively search for similar threats:

- Look for processes with similar behavior patterns
- Hunt for lateral movement indicators
- Check for dormant backdoors
- Review user account activity

### 7.3 Improve Detection

**Update the model:**
```python
# Retrain with new labeled data
# Add confirmed malicious samples to training set
# Adjust threshold if needed based on FP/FN analysis
```

**Tune alert thresholds:**
- Review false positives from this incident
- Adjust reconstruction error thresholds
- Refine priority scoring logic

### 7.4 Security Awareness

- Brief the team on the incident
- Update security policies
- Conduct training on identified attack vectors
- Share lessons learned

---

## Quick Reference: Common Malicious Patterns in Results

Based on the sample data, watch for:

### 1. Network Scanning/C2 Communication
```
eventName: socket, connect
args: Multiple different IPs, port 22 (SSH)
Example: processName='tsm' making repeated socket calls
```

### 2. Process Injection/Thread Creation
```
eventName: clone
args: CLONE_VM|CLONE_FS|CLONE_FILES|CLONE_SIGHAND|CLONE_THREAD
Example: Creating multiple threads with thread-pool-* names
```

### 3. Suspicious File Operations
```
eventName: security_file_open, access
args: Paths like /tmp/.X25-unix/, /tmp/*.tar.gz
Example: tar extracting to hidden directories
```

### 4. Privilege Manipulation
```
eventName: prctl, cap_capable
args: PR_SET_NAME, CAP_SETUID
Example: Processes changing their names or requesting capabilities
```

---

## Tools & Commands Reference

### Analysis Tools
```bash
# CSV analysis
csvstat new_test_results.csv
csvcut -c processName,hostName,priority new_test_results.csv | csvlook

# Network analysis
tcpdump -r capture.pcap
wireshark capture.pcap

# File analysis
file suspicious_binary
strings suspicious_binary
objdump -d suspicious_binary
```

### Response Tools
```bash
# Process investigation
ps -eFH | grep <processName>
lsof -p <pid>
cat /proc/<pid>/cmdline
cat /proc/<pid>/environ

# Network investigation
netstat -antup | grep <pid>
ss -antp | grep <pid>
lsof -i -P -n

# File investigation
find /tmp -type f -mtime -1
lsof | grep deleted
```

---

## Escalation Criteria

**Escalate to senior security team if:**
- More than 5 CRITICAL priority detections
- Evidence of data exfiltration
- Multiple hosts compromised
- APT indicators present
- Regulatory reporting required
- Production systems impacted

**Contact external help if:**
- Unknown sophisticated malware
- Need digital forensics expertise
- Legal/law enforcement involvement needed
- Ransomware incident

---

## Summary Checklist

- [ ] **Phase 1:** Reviewed all detection results and prioritized by severity
- [ ] **Phase 2:** Triaged anomalies and identified attack patterns
- [ ] **Phase 3:** Conducted deep investigation of top threats
- [ ] **Phase 4:** Classified threats and assessed business impact
- [ ] **Phase 5:** Contained threats and collected evidence
- [ ] **Phase 6:** Documented incident and shared IoCs
- [ ] **Phase 7:** Set up monitoring and improved defenses

---

## Additional Resources

- **MITRE ATT&CK Framework:** https://attack.mitre.org/
- **NIST Incident Response Guide:** https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-61r2.pdf
- **SANS Incident Handler's Handbook:** https://www.sans.org/white-papers/33901/
- **Threat Intelligence Platforms:** VirusTotal, AlienVault OTX, MISP

---

**Last Updated:** 2025-11-06
**Version:** 1.0
**Author:** Generated for STARAI Anomaly Detection Pipeline
