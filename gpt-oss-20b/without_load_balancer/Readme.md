# Gptoss 20b - HPC Deployment & Monitoring

This guide provides the workflow for deploying Gptoss 20b on HPC using vLLM, setting up monitoring, and running local performance stress tests.

---

## 1. HPC Setup & Monitoring
First, prepare the environment on the HPC cluster to track hardware metrics during the tests.

**Step 1: Create Log Directory**
Inside the hpc, create a directory to collect hardware logs:
```bash
mkdir gpt_tests_log
```


**Step 2: Monitoring Script**
Place the script `calcul_cpu_ram_gpu_%_per_30s.sh` inside the folder. This script monitors:
* CPU Usage %
* Memory Usage %
* GPU Util %
* VRAM Usage %

**Step 3: Launch the monitoring script**
Submit the job using the PBS script:
```bash
qsub gpt_gpu_monitoring.pbs
```



---

## 2. Connectivity & Verification

**Step 1: Check Job Status**
Verify the job is running :
```bash
qstat
```

identify the node (e.g., gpu08) :
```bash
qstat -f JOBID | grep exec_host
```

<img width="991" height="121" alt="Capture" src="https://github.com/user-attachments/assets/6ef660ac-e6bd-475b-a615-8e5e5cdc0e05" />

ssh the node and run the model using vllm library :
```bash
ssh gpu08
```
your VENV that can run vllm
```bash
conda activate gptoss20b_khalil
```
```bash
vllm serve /home/skiredj.abderrahman/fatnaoui/models/gptoss --port 9998
```

**Step 2: Internal Curl Test**
Test the LLM directly from the cluster login node:
```bash
curl http://gpu08:9998/v1/chat/completions -H "Content-Type: application/json" -d '{"model":"/home/skiredj.abderrahman/fatnaoui/models/gptoss","messages": [{"role": "user", "content": "how are you?"}],"max_tokens":50}'
```


**Step 3: SSH Tunneling**
Establish a tunnel from your local machine:
```bash
ssh -N -L 127.0.0.1:9998:gpu08:9998 skiredj.abderrahman@172.30.30.11
```


**Step 4: Local Test**
Test the tunnel in a new terminal:
```bash
curl -X POST http://127.0.0.1:9998/v1/chat/completions -H "Content-Type: application/json" -d "{\"model\": \"/home/skiredj.abderrahman/fatnaoui/models/gptoss\", \"messages\": [{\"role\": \"user\", \"content\": \"how are you?\"}], \"max_tokens\": 200}"
```

<img width="1029" height="84" alt="image" src="https://github.com/user-attachments/assets/1cde22e0-ebfe-40d5-bfb4-d022083b45c5" />

---

## 3. Visualization Stack (Docker)

Assuming you have cloned the repo, navigate to the folder and start the services:
```bash
cd .\gpt-oss-20b\without_load_balancer
```
```bash
docker-compose up -d
```


**Wait 30 seconds for services to start, then verify:**
```bash
Start-Sleep -Seconds 30
```
```bash
docker ps
```


**Access Grafana:**
* URL: http://localhost:3000/
* Login/Password: admin / admin
* Import Dashboards from: http://localhost:3000/dashboards
* Required JSONs: `Load_testing_results.json` & `tokens_testing_results.json`

---

## 4. Running Performance Tests (K6)

**Step 1: Reset InfluxDB**
Clear old data to start fresh:
```bash
docker exec influxdb influx -execute "DROP DATABASE k6"
```
```bash
docker exec influxdb influx -execute "CREATE DATABASE k6"
```


**Step 2: Execute K6 Test**
update vllm-test.js script and adapt it to your need 
Open PowerShell in the `without_load_balancer` folder and run:
```bash
$currentDir = (Get-Location).Path
```
```bash
docker run --rm -i --network host -v "${currentDir}/vllm-test.js:/vllm-test.js" grafana/k6:latest run --out influxdb=http://localhost:8086/k6 /vllm-test.js 2>&1 | Tee-Object -FilePath k6_output.txt
```

---

## 5. Data Collection
1. **K6 Logs:** Collect `k6_output.txt` once the test finishes.
2. **HPC Logs:** Run the `calcul_cpu_ram_gpu_%_per_30s.sh` on the HPC and collect for KV cache usage directly from the gpu node window where u runing gptoss.
<img width="1918" height="734" alt="image" src="https://github.com/user-attachments/assets/70ae851a-4b38-4714-ae0a-d8c6a3d580be" />
3. **Screenshots:** Use the "Go Full Page" extension in Chrome to capture the 2 Grafana dashboards.
<img width="1680" height="2216" alt="screencapture-localhost-3000-d-e33522df-989f-45ad-8c2b-ed4b0d8bb3c8-tokens-metrics-2026-02-06-13_14_27" src="https://github.com/user-attachments/assets/3e101924-73a4-4d89-8c96-ae4ccf1c222b" />
