# Time Series Forecasting


## Overview
This repository contains a master R script designed to take monthly time series data and perform end-to-end forecasting. The workflow is divided into systematic steps:

* **Data Preprocessing**: Train-test splitting, outlier detection, and additive data decomposition.
* **Stationarity Testing**: ADF and KPSS tests, determining the need for regular and seasonal differencing.
* **Phase 1 - Basic Selection & Diagnostics**: Baseline model fitting for Holt-Winters, ARIMA, and TBATS, complete with Ljung-Box tests for residual diagnostics.
* **Phase 2 - Advanced Tuning**:
  * **Holt-Winters**: Constraining Alpha/Beta/Gamma and testing multiple ETS structures (ZZZ, AAA, MAM).
  * **ARIMA**: Manual SARIMA candidate fitting vs. Auto-ARIMA benchmarking using AIC/BIC scoring.
  * **TBATS**: BATS vs. TBATS strict overfitting tests.
* **Phase 3 - Final Comparison**: Visual comparison (via `ggplot2`) of the best tuned models against the actual test data.

## Requirements

Ensure you have the following R packages installed before running the script:
```R
install.packages(c("forecast", "tseries", "ggplot2", "uroot"))
```

## Data Structure
The script expects a CSV file named `Sales.csv` in the root directory, containing a column named `Sales`. By default, it formats this as a monthly time series starting in January 2015. Modify the `ts()` function parameters in the script if your data frequency or start date differs.

## Performance Metrics (Test Set)

*Note: The following metrics will be generated upon running the script. Update these placeholders with your final results.*

| Model | RMSE | MAPE |
| :--- | :--- | :--- |
| **Tuned Holt-Winters (ETS)** | `59.75131` | `13.71803` |
| **Tuned SARIMA** | `54.93436` | `14.15825` |
| **Tuned Strict BATS/TBATS** | `58.68052` | `13.04437` |

## Usage
1. Run Data_Generation.R script  in your preferred R environment (e.g., RStudio / Posit Cloud).
2. Place your `Sales.csv` in the working directory.
3. Run the Full Code.R

