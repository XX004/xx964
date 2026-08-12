#GAss Time Series data generation
# --- Load packages ---
library(forecast)
library(tseries)


# Generate random TS data using last digit of each member ID
ID <- 858
set.seed(ID)


digits <- substr(ID, 1, 2)
sum_first_two <- sum(as.numeric(strsplit(digits, "")[[1]]))
if (sum_first_two < 6) {
  n <- sum_first_two + 2
} else {
  n <- sum_first_two - 2
}
n_months <- n*12
time <- 1:n_months


trend <- 80 + 2 * time
seasonal_pattern <- c(-40, -20, 0, 20, 40, 60, 80, 60, 40, 20, 0, -20)
seasonality <- rep(seasonal_pattern, length.out = n_months)
noise <- rnorm(n_months, 0, 50)


Sales <- round(trend + seasonality + noise, 0)
Month <- seq(as.Date("2015-01-01"), by = "month", length.out = n_months)


Sales_ts <- data.frame(
  Month = Month,
  Sales = Sales
)


write.csv(Sales_ts, "Sales.csv", row.names = FALSE)