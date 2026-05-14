import pandas as pd
import os

FILE_NAME = "products.xlsx"


def init_excel():
    if not os.path.exists(FILE_NAME):
        df = pd.DataFrame(
            columns=["id", "name", "category", "price", "quantity"]
        )
        df.to_excel(FILE_NAME, index=False)


def read_data():
    return pd.read_excel(FILE_NAME)


def save_data(df):
    df.to_excel(FILE_NAME, index=False)