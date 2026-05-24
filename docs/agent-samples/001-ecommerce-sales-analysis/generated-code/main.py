from __future__ import annotations

import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib import font_manager

try:
    import seaborn as sns
except ModuleNotFoundError:
    sns = None

try:
    import statsmodels.api as sm
    from statsmodels.tsa.seasonal import seasonal_decompose
except ModuleNotFoundError:
    sm = None
    seasonal_decompose = None


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = BASE_DIR / "original-files" / "online_sales.csv"
OUTPUT_DIR = BASE_DIR / "outputs"


def setup_plot_style() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if sns is not None:
        sns.set_theme(style="whitegrid")
    else:
        plt.style.use("ggplot")
    preferred_fonts = [
        "Microsoft YaHei",
        "SimHei",
        "Noto Sans CJK SC",
        "Source Han Sans SC",
        "Arial Unicode MS",
        "DejaVu Sans",
    ]
    available = {font.name for font in font_manager.fontManager.ttflist}
    for name in preferred_fonts:
        if name in available:
            plt.rcParams["font.sans-serif"] = [name]
            break
    plt.rcParams["axes.unicode_minus"] = False


def read_sales_data(path: Path) -> tuple[pd.DataFrame, str]:
    last_error: Exception | None = None
    for encoding in ("utf-8-sig", "utf-8", "gbk", "gb18030"):
        try:
            df = pd.read_csv(path, encoding=encoding)
            return df, encoding
        except UnicodeDecodeError as exc:
            last_error = exc
    raise RuntimeError(f"Cannot read CSV with common Chinese encodings: {last_error}")


def preprocess(df: pd.DataFrame) -> pd.DataFrame:
    required = {
        "order_date",
        "product",
        "category",
        "price",
        "quantity",
        "amount",
        "province",
        "channel",
    }
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")

    data = df.copy()
    data["order_date"] = pd.to_datetime(data["order_date"])
    for col in ["price", "quantity", "amount"]:
        data[col] = pd.to_numeric(data[col], errors="raise")
    data["month"] = data["order_date"].dt.to_period("M").astype(str)
    data["amount_check"] = data["price"] * data["quantity"]
    data["amount_match"] = np.isclose(data["amount"], data["amount_check"])
    return data


def save_table(df: pd.DataFrame, filename: str) -> None:
    df.to_csv(OUTPUT_DIR / filename, encoding="utf-8-sig")


def save_code_screenshot() -> None:
    code = Path(__file__).read_text(encoding="utf-8")
    lines = code.splitlines()
    shown_lines = lines[:95]
    fig_height = max(8, min(24, len(shown_lines) * 0.22))
    fig, ax = plt.subplots(figsize=(14, fig_height))
    ax.axis("off")
    rendered = "\n".join(f"{i + 1:>3}  {line}" for i, line in enumerate(shown_lines))
    ax.text(
        0.01,
        0.99,
        rendered,
        va="top",
        ha="left",
        family="monospace",
        fontsize=8,
        color="#1f2937",
    )
    ax.set_title("Code implementation screenshot: generated-code/main.py", loc="left", fontsize=12)
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "screenshot-code-implementation.png", dpi=180)
    plt.close(fig)


def plot_data_quality(data: pd.DataFrame, encoding: str) -> None:
    sample = data.head(8)[
        ["order_date", "product", "category", "price", "quantity", "amount", "province", "channel"]
    ].copy()
    sample["order_date"] = sample["order_date"].dt.strftime("%Y-%m-%d")
    quality_text = (
        f"encoding: {encoding}\n"
        f"rows: {len(data)}, columns: {len(data.columns) - 2}\n"
        f"date range: {data['order_date'].min().date()} to {data['order_date'].max().date()}\n"
        f"missing cells: {int(data.isna().sum().sum())}\n"
        f"duplicate rows: {int(data.duplicated().sum())}\n"
        f"amount = price * quantity mismatches: {int((~data['amount_match']).sum())}"
    )

    fig, axes = plt.subplots(2, 1, figsize=(13, 7), gridspec_kw={"height_ratios": [4, 1]})
    axes[0].axis("off")
    table = axes[0].table(cellText=sample.values, colLabels=sample.columns, loc="center")
    table.auto_set_font_size(False)
    table.set_fontsize(8)
    table.scale(1, 1.35)
    axes[0].set_title("Data preview")
    axes[1].axis("off")
    axes[1].text(0.01, 0.95, quality_text, va="top", ha="left", fontsize=11)
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "figure-01-data-quality.png", dpi=180)
    plt.close(fig)


def plot_descriptive(data: pd.DataFrame) -> pd.DataFrame:
    numeric_cols = ["price", "quantity", "amount"]
    desc = data[numeric_cols].describe().T
    desc["median"] = data[numeric_cols].median()
    save_table(desc, "table-descriptive-statistics.csv")

    fig, axes = plt.subplots(2, 3, figsize=(15, 8))
    for i, col in enumerate(numeric_cols):
        if sns is not None:
            sns.histplot(data[col], kde=True, ax=axes[0, i], color="#2563eb")
        else:
            axes[0, i].hist(data[col], bins=8, color="#2563eb", alpha=0.82)
        axes[0, i].set_title(f"{col} distribution")
        if sns is not None:
            sns.boxplot(y=data[col], ax=axes[1, i], color="#93c5fd")
        else:
            axes[1, i].boxplot(data[col], vert=True)
        axes[1, i].set_title(f"{col} boxplot")
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "figure-02-descriptive-distribution.png", dpi=180)
    plt.close(fig)
    return desc


def plot_group_structure(data: pd.DataFrame) -> dict[str, pd.DataFrame]:
    category = data.groupby("category").agg(
        amount=("amount", "sum"),
        quantity=("quantity", "sum"),
        avg_price=("price", "mean"),
    ).sort_values("amount", ascending=False)
    category["amount_share"] = category["amount"] / category["amount"].sum()

    province = data.groupby("province").agg(
        amount=("amount", "sum"),
        quantity=("quantity", "sum"),
        avg_price=("price", "mean"),
    ).sort_values("amount", ascending=False)
    province["amount_share"] = province["amount"] / province["amount"].sum()

    channel = data.groupby("channel").agg(
        amount=("amount", "sum"),
        quantity=("quantity", "sum"),
        avg_price=("price", "mean"),
    ).sort_values("amount", ascending=False)
    channel["amount_share"] = channel["amount"] / channel["amount"].sum()

    save_table(category, "table-category-summary.csv")
    save_table(province, "table-province-summary.csv")
    save_table(channel, "table-channel-summary.csv")

    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    if sns is not None:
        sns.barplot(x=category.index, y=category["amount"], ax=axes[0], color="#2563eb")
    else:
        axes[0].bar(category.index, category["amount"], color="#2563eb")
    axes[0].set_title("Sales amount by category")
    axes[0].set_xlabel("category")
    axes[0].set_ylabel("amount")
    axes[1].pie(category["amount"], labels=category.index, autopct="%1.1f%%", startangle=90)
    axes[1].set_title("Category amount share")
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "figure-03-category-structure.png", dpi=180)
    plt.close(fig)

    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    if sns is not None:
        sns.barplot(x=province.index, y=province["amount"], ax=axes[0], color="#16a34a")
    else:
        axes[0].bar(province.index, province["amount"], color="#16a34a")
    axes[0].set_title("Sales amount by province")
    axes[0].set_xlabel("province")
    axes[0].set_ylabel("amount")
    if sns is not None:
        sns.barplot(x=channel.index, y=channel["amount"], ax=axes[1], color="#f97316")
    else:
        axes[1].bar(channel.index, channel["amount"], color="#f97316")
    axes[1].set_title("Sales amount by channel")
    axes[1].set_xlabel("channel")
    axes[1].set_ylabel("amount")
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "figure-04-province-channel-comparison.png", dpi=180)
    plt.close(fig)

    return {"category": category, "province": province, "channel": channel}


def plot_monthly_and_regression(data: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, float]]:
    monthly = data.groupby("month").agg(amount=("amount", "sum"), quantity=("quantity", "sum"))
    monthly = monthly.sort_index()
    monthly["month_index"] = np.arange(1, len(monthly) + 1)
    save_table(monthly, "table-monthly-summary.csv")

    if sm is not None:
        x = sm.add_constant(data["quantity"])
        model = sm.OLS(data["amount"], x).fit()
        intercept = float(model.params["const"])
        slope = float(model.params["quantity"])
        r_squared = float(model.rsquared)
        p_value_quantity = float(model.pvalues["quantity"])
    else:
        slope, intercept = np.polyfit(data["quantity"], data["amount"], 1)
        fitted = intercept + slope * data["quantity"]
        ss_res = float(((data["amount"] - fitted) ** 2).sum())
        ss_tot = float(((data["amount"] - data["amount"].mean()) ** 2).sum())
        r_squared = 1 - ss_res / ss_tot
        p_value_quantity = float("nan")
    reg = {
        "intercept": float(intercept),
        "slope": float(slope),
        "r_squared": float(r_squared),
        "p_value_quantity": float(p_value_quantity),
    }

    pred_quantities = pd.DataFrame({"quantity": [1, 2, 5, 10, 20]})
    pred_quantities["predicted_amount"] = intercept + slope * pred_quantities["quantity"]
    save_table(pred_quantities, "table-regression-predictions.csv")

    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    if sns is not None:
        sns.regplot(x="quantity", y="amount", data=data, ax=axes[0], color="#7c3aed")
    else:
        axes[0].scatter(data["quantity"], data["amount"], color="#7c3aed")
        xs = np.linspace(data["quantity"].min(), data["quantity"].max(), 100)
        axes[0].plot(xs, intercept + slope * xs, color="#111827")
    axes[0].set_title("Linear regression: quantity -> amount")
    axes[0].set_xlabel("quantity")
    axes[0].set_ylabel("amount")

    axes[1].plot(monthly.index, monthly["amount"], marker="o", linewidth=2, color="#dc2626")
    axes[1].set_title("Monthly sales amount")
    axes[1].set_xlabel("month")
    axes[1].set_ylabel("amount")
    axes[1].tick_params(axis="x", rotation=30)
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "figure-05-regression-and-monthly-trend.png", dpi=180)
    plt.close(fig)

    if len(monthly) >= 4 and seasonal_decompose is not None:
        decomposition = seasonal_decompose(monthly["amount"], model="additive", period=2)
        fig = decomposition.plot()
        fig.set_size_inches(12, 8)
        fig.tight_layout()
        fig.savefig(OUTPUT_DIR / "figure-06-time-series-decomposition.png", dpi=180)
        plt.close(fig)
    elif len(monthly) >= 4:
        trend = monthly["amount"].rolling(window=2, min_periods=1).mean()
        seasonal_like = monthly["amount"] - trend
        residual_like = monthly["amount"] - trend - seasonal_like.mean()
        fig, axes = plt.subplots(4, 1, figsize=(12, 8), sharex=True)
        axes[0].plot(monthly.index, monthly["amount"], marker="o")
        axes[0].set_title("Observed")
        axes[1].plot(monthly.index, trend, marker="o")
        axes[1].set_title("Rolling trend fallback")
        axes[2].bar(monthly.index, seasonal_like)
        axes[2].set_title("Seasonal-like fluctuation fallback")
        axes[3].bar(monthly.index, residual_like)
        axes[3].set_title("Residual-like fallback")
        fig.tight_layout()
        fig.savefig(OUTPUT_DIR / "figure-06-time-series-decomposition.png", dpi=180)
        plt.close(fig)

    month_slope, month_intercept = np.polyfit(monthly["month_index"], monthly["amount"], 1)
    future = pd.DataFrame({"month_index": [len(monthly) + 1, len(monthly) + 2]})
    future["forecast_amount"] = month_intercept + month_slope * future["month_index"]
    future["forecast_month"] = ["next_month_1", "next_month_2"]
    save_table(future[["forecast_month", "month_index", "forecast_amount"]], "table-monthly-forecast.csv")

    return monthly, reg


def main() -> int:
    setup_plot_style()
    print("=== Ecommerce Sales Analysis ===")
    print(f"data_path={DATA_PATH}")

    raw, encoding = read_sales_data(DATA_PATH)
    data = preprocess(raw)
    print(f"encoding_used={encoding}")
    print(f"seaborn_available={sns is not None}")
    print(f"statsmodels_available={sm is not None}")
    print(f"rows={len(data)}")
    print(f"columns={list(raw.columns)}")
    print(f"date_range={data['order_date'].min().date()} to {data['order_date'].max().date()}")
    print(f"missing_cells={int(data.isna().sum().sum())}")
    print(f"duplicate_rows={int(data.duplicated().sum())}")
    print(f"amount_mismatch_rows={int((~data['amount_match']).sum())}")
    print(f"total_amount={data['amount'].sum():.2f}")
    print(f"total_quantity={data['quantity'].sum():.0f}")
    print(f"average_order_amount={data['amount'].mean():.2f}")
    print(f"median_order_amount={data['amount'].median():.2f}")

    save_code_screenshot()
    plot_data_quality(data, encoding)
    desc = plot_descriptive(data)
    grouped = plot_group_structure(data)
    monthly, reg = plot_monthly_and_regression(data)

    print("\n--- Descriptive statistics ---")
    print(desc.round(2).to_string())
    print("\n--- Category summary ---")
    print(grouped["category"].round(4).to_string())
    print("\n--- Province summary ---")
    print(grouped["province"].round(4).to_string())
    print("\n--- Channel summary ---")
    print(grouped["channel"].round(4).to_string())
    print("\n--- Monthly summary ---")
    print(monthly.round(2).to_string())
    print("\n--- Linear regression ---")
    print(
        "amount = "
        f"{reg['intercept']:.2f} + ({reg['slope']:.2f}) * quantity; "
        f"R^2={reg['r_squared']:.4f}; p={reg['p_value_quantity']:.4f}"
    )
    print("\nGenerated files:")
    for path in sorted(OUTPUT_DIR.iterdir()):
        print(f"- {path.name}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
