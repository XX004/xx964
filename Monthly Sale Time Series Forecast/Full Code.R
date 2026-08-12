# ============================================================
# TIME SERIES FORECASTING: ULTIMATE MASTER SCRIPT
# Models: Holt-Winters (ETS), ARIMA/SARIMA, TBATS/BATS
# ============================================================


# --- 1. Load All Necessary Packages ---
library(forecast)
library(tseries)
library(ggplot2)
library(uroot)


# --- 2. Load Data & Train-Test Split (~70% / 30%) ---
data <- read.csv("Sales.csv")
sales_ts <- ts(data$Sales, frequency = 12, start = c(2015, 1))


train <- window(sales_ts, end = c(2022, 12))
test <- window(sales_ts, start = c(2023, 1))
h <- length(test)


# --- 3. Outlier Checking ---
cat("\n--- OUTLIER CHECKING ---\n")
train_outliers <- tsoutliers(train)
print(train_outliers)
plot(train, main = "Training Data with Outlier Check", ylab = "Sales", xlab = "Time")
if(length(train_outliers$index) > 0) {
  points(time(train)[train_outliers$index], train_outliers$repl, col = "red", pch = 19)
} else {
  cat("No significant outliers detected.\n")
}


# --- 4. Data Decomposition ---
decomp <- decompose(train, type = "additive")
plot(decomp)


# --- 5. Stationarity Tests & Differencing ---
cat("\n--- STATIONARITY TESTS ---\n")
print(adf.test(train, k = 12))
print(kpss.test(train))


nd <- ndiffs(train)          
ns <- nsdiffs(train)        
cat("\nRegular differences needed:", nd)
cat("\nSeasonal differences needed:", ns, "\n")


if(nd > 0 | ns > 0) {
  cat("\nData is non-stationary. Applying differencing...\n")
  train_diff <- train
  if(ns > 0) train_diff <- diff(train_diff, lag = 12)
  if(nd > 0) train_diff <- diff(train_diff)
  
  acf(train_diff,  main = "ACF after Differencing")
  pacf(train_diff, main = "PACF after Differencing")
} else {
  cat("\nData is already stationary. No differencing needed.\n")
}




# ============================================================
# PHASE 1: BASIC SELECTION & DIAGNOSTICS
# ============================================================


# --- A. HOLT-WINTERS FAMILY ---
cat("\n=== 1. HOLT-WINTERS SELECTION & DIAGNOSTICS ===\n")
# 1. Selection
hw_add <- hw(train, seasonal = "additive", h = h)
hw_damped <- hw(train, seasonal = "additive", damped = TRUE, h = h)
hw_mult <- hw(train, seasonal = "multiplicative", h = h)


print(accuracy(hw_add, test))
print(accuracy(hw_damped, test))
print(accuracy(hw_mult, test))


# We assign the winner based on our previous test
hw_best <- hw_add
cat("Selected Best HW Model: Standard Additive\n")


# 2. Diagnostic Check (Plots & Math)
checkresiduals(hw_best) # THIS GENERATES YOUR RESIDUAL PLOTS!
hw_lb_test <- Box.test(residuals(hw_best), lag = 19, type = "Ljung-Box")
print(hw_lb_test)


# 3. Fit Decision & Forecast Plot
if(hw_lb_test$p.value > 0.05) {
  cat("Result: Model is a GOOD FIT. Proceeding to forecast.\n")
  print(accuracy(hw_best, test)[,c("RMSE","MAPE")])
  print(autoplot(hw_best) + ggtitle("Best Holt-Winters Forecast") + theme_minimal())
} else {
  cat("Result: Model DOES NOT FIT. Tuning required.\n")
}




# --- B. ARIMA FAMILY ---
cat("\n=== 2. ARIMA SELECTION & DIAGNOSTICS ===\n")
# 1. Selection
arima_model <- auto.arima(train)
cat("Selected Best ARIMA Model:\n")
print(arima_model)


# 2. Diagnostic Check
checkresiduals(arima_model)
arima_lb_test <- Box.test(residuals(arima_model), lag = 19, type = "Ljung-Box")
print(arima_lb_test)


# 3. Fit Decision & Forecast
if(arima_lb_test$p.value > 0.05) {
  cat("Result: Model is a GOOD FIT. Proceeding to forecast.\n")
  arima_forecast_basic <- forecast(arima_model, h = h)
  print(accuracy(arima_forecast_basic, test)[,c("RMSE","MAPE")])
  print(autoplot(arima_forecast_basic) + ggtitle("Best ARIMA Forecast") + theme_minimal())
} else {
  cat("Result: Model DOES NOT FIT. Tuning required.\n")
}




# --- C. TBATS FAMILY ---
cat("\n=== 3. TBATS SELECTION & DIAGNOSTICS ===\n")
# 1. Selection
tbats_model <- tbats(train)
cat("Selected Best TBATS Model:\n")
print(tbats_model)


# 2. Diagnostic Check (Plots & Math)
checkresiduals(tbats_model)
tbats_lb_test <- Box.test(residuals(tbats_model), lag = 19, type = "Ljung-Box")
print(tbats_lb_test)


# 3. Fit Decision & Forecast Plot
if(tbats_lb_test$p.value > 0.05) {
  cat("Result: Model is a GOOD FIT. Proceeding to forecast.\n")
  tbats_forecast <- forecast(tbats_model, h = h)
  print(accuracy(tbats_forecast, test)[,c("RMSE","MAPE")])
  print(autoplot(tbats_forecast) + ggtitle("Best TBATS Forecast") + theme_minimal())
} else {
  cat("Result: Model DOES NOT FIT. Tuning required.\n")
}

# ============================================================
# PHASE 2: ADVANCED TUNING
# ============================================================


# --- ADVANCED A: HOLT-WINTERS TUNING ---
cat("\n============================================================\n")
cat("HOLT-WINTERS TUNING — Constrain Alpha/Beta/Gamma\n")
cat("============================================================\n")


hw_candidates <- list(
  # Tight smoothing across all components
  hw1 = ets(train, model="ZZZ", alpha=0.1, beta=0.01, gamma=0.1),
  hw2 = ets(train, model="ZZZ", alpha=0.2, beta=0.01, gamma=0.1),
  hw3 = ets(train, model="ZZZ", alpha=0.2, beta=0.05, gamma=0.2),
  hw4 = ets(train, model="ZZZ", alpha=0.3, beta=0.01, gamma=0.1),
  hw5 = ets(train, model="ZZZ", alpha=0.3, beta=0.05, gamma=0.2),
  hw6 = ets(train, model="ZZZ", alpha=0.1, beta=0.01, gamma=0.2),
  
  # Fix model structure explicitly (additive error, additive seasonal)
  hw7 = ets(train, model="AAA", alpha=0.2, beta=0.01, gamma=0.1),
  hw8 = ets(train, model="AAA", alpha=0.3, beta=0.05, gamma=0.2),
  
  # Multiplicative seasonal (good for data with growing seasonality)
  hw9  = ets(train, model="MAM", alpha=0.2, beta=0.01, gamma=0.1),
  hw10 = ets(train, model="MAM", alpha=0.3, beta=0.05, gamma=0.2),
  
  # Damped trend versions (dampens long-run trend extrapolation)
  hw11 = ets(train, model="AAA", damped=TRUE, alpha=0.2, beta=0.05, gamma=0.1),
  hw12 = ets(train, model="AAA", damped=TRUE, alpha=0.3, beta=0.05, gamma=0.2),
  hw13 = ets(train, model="MAM", damped=TRUE, alpha=0.2, beta=0.05, gamma=0.1),
  
  # Baseline (your current auto-selected model)
  hw14 = ets(train, model="ZZZ")
)


hw_ets_result <- data.frame(
  Model      = names(hw_candidates),
  Train_RMSE = sapply(hw_candidates, function(m) round(accuracy(forecast(m, h=h), test)["Training set","RMSE"], 2)),
  Test_RMSE  = sapply(hw_candidates, function(m) round(accuracy(forecast(m, h=h), test)["Test set",    "RMSE"], 2)),
  Train_MAPE = sapply(hw_candidates, function(m) round(accuracy(forecast(m, h=h), test)["Training set","MAPE"], 2)),
  Test_MAPE  = sapply(hw_candidates, function(m) round(accuracy(forecast(m, h=h), test)["Test set",    "MAPE"], 2))
)


hw_ets_result$RMSE_Gap <- round(abs(hw_ets_result$Train_RMSE - hw_ets_result$Test_RMSE), 2)
hw_ets_result$MAPE_Gap <- round(abs(hw_ets_result$Train_MAPE - hw_ets_result$Test_MAPE), 2)
hw_ets_result$Score    <- round(scale(hw_ets_result$Test_RMSE) + scale(hw_ets_result$MAPE_Gap), 2)


cat("\n=== Holt-Winters ETS Tuning Results ===\n\n")
print(hw_ets_result[order(hw_ets_result$Score), ])


best_hw_idx <- which.min(hw_ets_result$Score)
best_hw_ets <- hw_candidates[[best_hw_idx]]


cat("\nBest model:", hw_ets_result$Model[best_hw_idx], "\n")


# Residual check
hw_ets_lb <- Box.test(residuals(best_hw_ets), lag = 19, type = "Ljung-Box")
print(hw_ets_lb)
if (hw_ets_lb$p.value > 0.05) cat("GOOD FIT\n") else cat("POOR FIT — try next best Score row\n")


# Forecast
hw_ets_forecast <- forecast(best_hw_ets, h = h)
print(accuracy(hw_ets_forecast, test)[, c("RMSE","MAPE")])
print(autoplot(hw_ets_forecast) + ggtitle("Best Holt-Winters (ETS) Forecast") + theme_minimal())


# --- ADVANCED B: ARIMA TUNING ---
cat("\n============================================================\n")
cat("ARIMA SECTION — Manual SARIMA Fitting + Auto Benchmark\n")
cat("============================================================\n")


# DIFFERENCING TESTS
cat("\n--- DIFFERENCING TESTS ---\n")
cat("Regular diffs needed  (KPSS):", ndiffs(train,  test = "kpss"), "\n")
cat("Seasonal diffs needed (CH)  :", nsdiffs(train, test = "ch"),   "\n")


# Apply regular difference (d=1)
train_d1    <- diff(train, differences = 1)


cat("\n--- KPSS Test after Regular Differencing ---\n")
print(kpss.test(train_d1))   # Target: p > 0.05


# Apply seasonal difference (D=1)
train_d1_D1 <- diff(train_d1, lag = 12)


cat("\n--- CH Test after Seasonal Differencing ---\n")
print(ch.test(train_d1_D1))


# ACF/PACF PLOTS
ggtsdisplay(train, main = "Monthly Sales — Training Data (Original)")
ggtsdisplay(train_d1, main = "After Regular Differencing (d=1)")
ggtsdisplay(train_d1_D1, main = "After Regular + Seasonal Differencing (d=1, D=1)")


# MANUAL SARIMA CANDIDATES
cat("\n--- Fitting Manual SARIMA Candidates ---\n")
arima_fit1 <- Arima(train, order=c(0,1,1), seasonal=c(0,1,1))
arima_fit2 <- Arima(train, order=c(1,1,0), seasonal=c(1,1,0))
arima_fit3 <- Arima(train, order=c(1,1,1), seasonal=c(0,1,1))
arima_fit4 <- Arima(train, order=c(0,1,1), seasonal=c(1,1,0))
arima_fit5 <- Arima(train, order=c(1,1,0), seasonal=c(0,1,1))


# AUTO ARIMA BENCHMARK
cat("\n--- Auto ARIMA (Exhaustive Search) ---\n")
auto_arima_fit <- auto.arima(train,
                             d = 1, D = 1,
                             stepwise     = FALSE,
                             approximation= FALSE,
                             ic           = "aic",
                             trace        = TRUE)
summary(auto_arima_fit)


# AIC / BIC COMPARISON TABLE
arima_fitting_result <- data.frame(
  Model = c(
    "SARIMA(0,1,1)(0,1,1)[12]",
    "SARIMA(1,1,0)(1,1,0)[12]",
    "SARIMA(1,1,1)(0,1,1)[12]",
    "SARIMA(0,1,1)(1,1,0)[12]",
    "SARIMA(1,1,0)(0,1,1)[12]",
    paste0("AUTO: SARIMA(",
           arimaorder(auto_arima_fit)[1], ",",
           arimaorder(auto_arima_fit)[2], ",",
           arimaorder(auto_arima_fit)[3], ")(",
           arimaorder(auto_arima_fit)[4], ",",
           arimaorder(auto_arima_fit)[5], ",",
           arimaorder(auto_arima_fit)[6], ")[12]")
  ),
  AIC = c(AIC(arima_fit1), AIC(arima_fit2), AIC(arima_fit3),
          AIC(arima_fit4), AIC(arima_fit5), AIC(auto_arima_fit)),
  BIC = c(BIC(arima_fit1), BIC(arima_fit2), BIC(arima_fit3),
          BIC(arima_fit4), BIC(arima_fit5), BIC(auto_arima_fit))
)


cat("\n=== SARIMA Model Comparison: AIC and BIC ===\n\n")
print(arima_fitting_result)


best_aic_model <- arima_fitting_result$Model[which.min(arima_fitting_result$AIC)]
best_bic_model <- arima_fitting_result$Model[which.min(arima_fitting_result$BIC)]
cat("\nLowest AIC:", best_aic_model, "\n")
cat("Lowest BIC:", best_bic_model, "\n")


# DEFAULTING BEST MODEL TO FIT 1 (Update as needed)
arima_best <- arima_fit1  


cat("\n--- Residual Diagnostics: Best SARIMA ---\n")
checkresiduals(arima_best)
arima_lb <- Box.test(residuals(arima_best), lag = 19, type = "Ljung-Box")
print(arima_lb)


if (arima_lb$p.value > 0.05) {
  cat("Result: GOOD FIT — residuals are white noise (p > 0.05)\n")
} else {
  cat("Result: POOR FIT — residuals show pattern (p < 0.05), consider another candidate\n")
}


# FORECAST & ACCURACY
arima_forecast_tuned <- forecast(arima_best, h = h)


cat("\n--- Forecast Accuracy ---\n")
print(accuracy(arima_forecast_tuned, test)[, c("RMSE", "MAPE")])


plot(arima_forecast_tuned,
     main = paste("Forecast:", best_aic_model),
     ylab = "Sales",
     xlab = "Time")
lines(test, col = "turquoise2", lwd = 2)
legend("topleft", legend = c("Forecast", "Actual Test"), col = c("blue", "turquoise2"), lwd = 2)


# --- ADVANCED C: TBATS TUNING ---
cat("\n============================================================\n")
cat("BATS vs TBATS — The Ultimate Overfitting Test\n")
cat("============================================================\n")


cat("\n--- FIT BATS & ULTRA-STRICT TBATS ---\n")


bats_strict <- bats(train,
                    use.box.cox = FALSE,
                    use.trend = FALSE,
                    use.arma.errors = FALSE)


bats_damped <- bats(train,
                    use.box.cox = FALSE,
                    use.trend = TRUE,
                    use.damped.trend = TRUE,
                    use.arma.errors = FALSE)


tbats_strict <- tbats(train,
                      use.box.cox = FALSE,
                      use.trend = FALSE,
                      use.arma.errors = FALSE)


strict_list <- list(
  "BATS (Strict)"        = bats_strict,
  "BATS (Damped Trend)"  = bats_damped,
  "TBATS (Ultra-Strict)" = tbats_strict
)


strict_result <- data.frame(
  Model      = names(strict_list),
  Train_RMSE = sapply(strict_list, function(m) round(accuracy(forecast(m, h=h), test)["Training set","RMSE"], 2)),
  Test_RMSE  = sapply(strict_list, function(m) round(accuracy(forecast(m, h=h), test)["Test set",    "RMSE"], 2)),
  Train_MAPE = sapply(strict_list, function(m) round(accuracy(forecast(m, h=h), test)["Training set","MAPE"], 2)),
  Test_MAPE  = sapply(strict_list, function(m) round(accuracy(forecast(m, h=h), test)["Test set",    "MAPE"], 2))
)


strict_result$RMSE_Gap <- round(abs(strict_result$Train_RMSE - strict_result$Test_RMSE), 2)
strict_result$MAPE_Gap <- round(abs(strict_result$Train_MAPE - strict_result$Test_MAPE), 2)
strict_result$Score    <- round(scale(strict_result$Test_RMSE) + scale(strict_result$MAPE_Gap), 2)


cat("\n=== Final Strict Tuning Leaderboard ===\n\n")
print(strict_result)


best_strict_score <- which.min(strict_result$Score)
best_model_tbats <- strict_list[[best_strict_score]]


cat("\nBest Model Found:", strict_result$Model[best_strict_score], "\n")


tbats_forecast_tuned <- forecast(best_model_tbats, h = h)


print(accuracy(tbats_forecast_tuned, test))


plot(tbats_forecast_tuned,
     main = paste("Forecast:", strict_result$Model[best_strict_score]),
     ylab = "Sales", xlab = "Time")
lines(test, col = "turquoise2", lwd = 2)
legend("topleft", legend = c("Forecast", "Actual Test"), col = c("blue", "turquoise2"), lwd = 2)


print(accuracy(hw_ets_forecast, test)[, c("RMSE","MAPE")])
print(accuracy(arima_forecast_tuned, test)[, c("RMSE", "MAPE")])
print(accuracy(tbats_forecast_tuned, test)[, c("RMSE", "MAPE")])


# ============================================================
# PHASE 3: FINAL COMPARISON PLOTS
# ============================================================
master_plot_tuned <- autoplot(sales_ts) +
  autolayer(hw_ets_forecast, series="Tuned HW (ETS)", PI=FALSE) +
  autolayer(arima_forecast_tuned, series="Tuned SARIMA", PI=FALSE) +
  autolayer(tbats_forecast_tuned, series="Tuned Strict BATS/TBATS", PI=FALSE) +
  xlab("Year") + ylab("Sales") +
  ggtitle("Phase 3 Comparison: TUNED ETS vs TUNED SARIMA vs TUNED TBATS/BATS") +
  theme_minimal()


print(master_plot_tuned)

checkresiduals(best_hw_ets)
