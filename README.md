## Performance Testing Setup on HPC GPUs

This repository provides the **configuration, scripts, and technical steps** required to run performance testing in an HPC environment using **k6** for load generation, **InfluxDB** for metrics collection, and **Grafana** for dashboard visualization.

All setups target **NVIDIA L40S GPUs** with **48 GB of GPU memory**.

---

## Supported Models

The repository includes deployment and testing configurations for the following models:

- **gemma-27b-it-int4-awq**
- **gpt-oss-20b**

---

## Deployment Topologies

For each model, two deployment setups are documented:

1. **Single-GPU deployment**
2. **Multi-GPU deployment** using **NGINX as a load balancer**

A Ray-based distributed setup is intentionally excluded. The HPC environment does not support **InfiniBand (IB)** and only provides **TCP networking**, which introduces significant overhead for tightly coupled multi-GPU workloads.

To avoid this limitation, each model instance is deployed **independently on a dedicated GPU**, with **NGINX** handling request distribution across instances.

---

## Scope of This Repository

This repository **does not include benchmark results or performance comparisons**. Its primary goal is to demonstrate **how to configure, deploy, and instrument** GPU-backed inference services on HPC systems.

### Included Components

- k6 load-testing scripts  
- InfluxDB metrics ingestion configuration  
- Grafana dashboard setup  
- NGINX-based load balancing for multi-GPU inference  

---
