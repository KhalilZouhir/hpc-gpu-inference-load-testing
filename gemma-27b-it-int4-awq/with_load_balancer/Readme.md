# Gemma 27b-it (With Load Balancer) - HPC Deployment & Monitoring

This guide provides the workflow for deploying Gemma 27b-it across two nodes on HPC using a load balancer, setting up dual-node monitoring, and running local performance stress tests.

---

## 1. HPC Setup & Monitoring (Dual Node)
Prepare the environment on both HPC nodes to track hardware metrics simultaneously.

**Step 1: Create Log Directories**
Create directories to collect logs for both GPU nodes:
```bash
mkdir gpu_tests_log
```
```bash
mkdir gpu_tests_log_second_node
```


**Step 2: Monitoring Scripts**
Place the script `calcul_cpu_ram_gpu_%_per_30s.sh` inside **both** folders created above. This script monitors CPU, Memory, GPU Util, and VRAM.

**Step 3: Launch the LLM Jobs**
Submit the jobs for both nodes:
```bash
qsub vllm_gemma_&_monitoring_gpu1
```
```bash
qsub vllm_gemma_&_monitoring_gpu2
```


---

## 2. Connectivity & Multi-Node Verification

**Step 1: Identify Host Nodes**
Run the following for both Job IDs to find which nodes (e.g., gpu08 and gpu07) are hosting the LLMs:
```bash
qstat -f JOBID | grep exec_host
```

<img width="991" height="121" alt="Capture" src="https://github.com/user-attachments/assets/6ef660ac-e6bd-475b-a615-8e5e5cdc0e05" />

**Step 2: Multi-Port SSH Tunneling**
Establish a tunnel for both nodes from your local machine (using port 9998 for node 1 and 9997 for node 2):
```bash
ssh -N -g -L 0.0.0.0:9998:gpu08:9998 -L 0.0.0.0:9997:gpu07:9997 skiredj.abderrahman@172.30.30.11
```


**Step 3: Verify Individual Tunnels**
Test both nodes locally to ensure the vLLM engines are responding open 2 cmd windows and execute the following:
```bash
curl -X POST http://localhost:9998/v1/completions -H "Content-Type: application/json" -d "{\"model\":\"/home/skiredj.abderrahman/models/gemma27b-it-int4-awq\",\"prompt\":\"do u have a wish\",\"max_tokens\":50}"
```
<img width="1029" height="84" alt="image" src="https://github.com/user-attachments/assets/1cde22e0-ebfe-40d5-bfb4-d022083b45c5" />
```bash
curl -X POST http://localhost:9997/v1/completions -H "Content-Type: application/json" -d "{\"model\":\"/home/skiredj.abderrahman/models/gemma27b-it-int4-awq\",\"prompt\":\"do u have a wish\",\"max_tokens\":50}"
```


---

## 3. Visualization Stack & Load Balancer (Docker)

Navigate to the directory and start the stack (which includes the load balancer on port 8080):
```bash
cd .\gemma-27b-it-int4-awq\with_load_balancer
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


**Test the Load Balancer:**
Verify that the load balancer is correctly routing requests:
```bash
curl -X POST http://localhost:8080/v1/completions -H "Content-Type: application/json" -d "{\"model\":\"/home/skiredj.abderrahman/models/gemma27b-it-int4-awq\",\"prompt\":\"test load balancer\",\"max_tokens\":10}"

```

---

## 4. Running Performance Tests (K6)

**Step 1: Reset InfluxDB**
```bash
docker exec influxdb influx -execute "DROP DATABASE k6"
```
```bash
docker exec influxdb influx -execute "CREATE DATABASE k6"
```


**Step 2: Execute K6 Test**
Open PowerShell in the `with_load_balancer` folder and run:
```bash
$currentDir = (Get-Location).Path
```
```bash
docker run --rm -i --network host -v "${currentDir}/vllm-test.js:/vllm-test.js" grafana/k6:latest run --out influxdb=http://localhost:8086/k6 /vllm-test.js 2>&1 | Tee-Object -FilePath k6_output.txt
```


---

## 5. Data Collection & Analysis
1. **Grafana:** Access http://localhost:3000/ to view the `Load_testing_results.json` and `tokens_testing_results.json` dashboards.
2. **HPC Logs:** Ensure you collect hardware logs from **both** `gpu_tests_log` and `gpu_tests_log_second_node` by runing the `calcul_cpu_ram_gpu_%_per_30s.sh` script on both for the gpu KV cache u can find it in the logs (if u run vllm serve direct in the node it would be mush easier to visualise logs).
3.  *Tip: Visualizing logs is easier if you run `vllm serve` directly in the GPU node instead of as a background script .check gptoss20b readme to get an idea on how to do so *.
 <img width="1918" height="734" alt="image" src="https://github.com/user-attachments/assets/70ae851a-4b38-4714-ae0a-d8c6a3d580be" />
4. **Screenshots:** Use the "Go Full Page" extension in Chrome to capture the 2 Grafana dashboards.
<img width="1680" height="2216" alt="screencapture-localhost-3000-d-e33522df-989f-45ad-8c2b-ed4b0d8bb3c8-tokens-metrics-2026-02-06-13_14_27" src="https://github.com/user-attachments/assets/3e101924-73a4-4d89-8c96-ae4ccf1c222b" />
