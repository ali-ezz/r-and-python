from database import *
Base.metadata.drop_all(bind=engine)

#import pyodbc

#print(pyodbc.drivers())