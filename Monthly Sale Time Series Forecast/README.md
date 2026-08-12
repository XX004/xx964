# Time Series Forecasting: Ultimate Master Script

A comprehensive R script for time series forecasting, featuring basic model selection, diagnostics, and advanced hyperparameter tuning for Holt-Winters (ETS), ARIMA/SARIMA, and TBATS/BATS models.

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
| **Tuned Holt-Winters (ETS)** | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| **Tuned SARIMA** | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| **Tuned Strict BATS/TBATS** | `[PLACEHOLDER]` | `[PLACEHOLDER]` |

## Usage
1. Clone the repository and place your `Sales.csv` in the working directory.
2. Run the script in your preferred R environment (e.g., RStudio).
3. Check the console for accuracy leaderboards, Ljung-Box test p-values, and AIC/BIC comparisons.
4. Review the generated plots for visual forecast comparisons and residual diagnostics.
