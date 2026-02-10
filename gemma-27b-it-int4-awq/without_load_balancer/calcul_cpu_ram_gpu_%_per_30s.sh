#!/bin/bash
# Calculates CPU%, RAM% (host), GPU_Util% and VRAM_Usage% (GPU memory used/total)
# Expects:
#   vmstat.txt            -> your periodic vmstat dumps (same as before)
#   nvidia_smi.csv        -> logged via nvidia-smi --query-gpu=...,noheader,nounits

VMSTAT_FILE="vmstat.txt"
GPU_CSV="nvidia_smi.csv"

if [[ ! -f "$VMSTAT_FILE" ]]; then
  echo "File $VMSTAT_FILE not found!"
  exit 1
fi
if [[ ! -f "$GPU_CSV" ]]; then
  echo "File $GPU_CSV not found! (expected CSV from nvidia-smi --query-gpu=...)"
  exit 1
fi

# Total host memory in KB
TOTAL_MEM=$(grep MemTotal /proc/meminfo | awk '{print $2}')

echo "CPU_Usage%,Memory_Usage%,GPU_Util%,VRAM_Usage%"

# --- Load & clean vmstat lines (skip headers/blank/separators) ---
mapfile -t vmstat_lines < <(grep -vE 'procs|r[[:space:]]+b|^=|^$' "$VMSTAT_FILE")

# --- Load GPU CSV rows (timestamp,util%,mem_used(MiB),mem_total(MiB)) ---
mapfile -t gpu_rows < <(awk 'NF{gsub(/ /,""); print}' "$GPU_CSV")

len=${#vmstat_lines[@]}
for ((i = 0; i < len; i++)); do
  line="${vmstat_lines[$i]}"

  # Extract 'free' and 'id' fields from vmstat default format
  # vmstat columns (Linux): r b swpd free buff cache si so bi bo in cs us sy id wa st
  read -r _ _ _ free _ _ _ _ _ _ _ _ us sy id wa st <<< "$line"

  cpu_usage=$((100 - id))
  mem_used_kb=$((TOTAL_MEM - free))
  mem_usage_pct=$(awk -v u="$mem_used_kb" -v t="$TOTAL_MEM" 'BEGIN{printf("%.2f", (u/t)*100)}')

  # Match GPU row by index; if out of range, reuse last available
  gpu_idx=$i
  if (( gpu_idx >= ${#gpu_rows[@]} )); then
    gpu_idx=$((${#gpu_rows[@]} - 1))
  fi
  gpu_row="${gpu_rows[$gpu_idx]}"

  # gpu_row format after gsub spaces: YYYY/MM/DDHH:MM:SS,UTIL,MEM_USED,MEM_TOTAL
  IFS=',' read -r _ts util mem_used_mib mem_total_mib <<< "$gpu_row"

  # Compute VRAM usage %
  if [[ -n "$mem_used_mib" && -n "$mem_total_mib" && "$mem_total_mib" -gt 0 ]]; then
    vram_pct=$(awk -v u="$mem_used_mib" -v t="$mem_total_mib" 'BEGIN{printf("%.2f", (u/t)*100)}')
  else
    vram_pct="N/A"
  fi

  # If util is empty, set N/A
  [[ -z "$util" ]] && util="N/A"

  echo "${cpu_usage}%,$mem_usage_pct%,${util}%,$vram_pct%"
done
