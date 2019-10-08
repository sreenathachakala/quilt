import boto3
import time
import pandas as pd


pd.set_option('display.width', 1000)
pd.set_option('display.max_columns', 500)
pd.set_option('display.max_rows', 500)


def get_athena_client():
    return boto3.session.Session(profile_name='staging', region_name="us-east-1").client("athena")



def query(sql, database, output_location):
    # output_location is in form "s3://bucket/output_prefix/
    response = get_athena_client().start_query_execution(
            QueryString=sql,
            QueryExecutionContext={
                'Database': database
            },
            ResultConfiguration={
                'OutputLocation': output_location,
                'EncryptionConfiguration': {'EncryptionOption': 'SSE_S3'}
            },
    )
    return response['QueryExecutionId']

def transform_entry(var_char_value, col_type):
    if col_type == "varchar":
        return var_char_value
    elif col_type == "date":
        # TODO: Parse date correctly?
        return var_char_value
    elif col_type == "integer":
        return int(var_char_value)
    else:
        raise NotImplementedError(f"Don't know how to parse {col_type}")

def retrieve_results(query_execution_id):
    response = get_athena_client().get_query_results(QueryExecutionId=query_execution_id)
    # return format: https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/athena.html#Athena.Client.get_query_results
    column_info_list = response['ResultSet']['ResultSetMetadata']['ColumnInfo']
    col_headers = [c['Name'] for c in column_info_list]
    col_types = [c['Type'] for c in column_info_list]
    rows = []
    for i, raw_row in enumerate(response['ResultSet']['Rows']):
        if i == 0:
            continue # skip header row
        row = []
        for i, col in enumerate(raw_row['Data']):
            col_type = col_types[i]
            d = col['VarCharValue']
            row.append(transform_entry(d, col_type))
        rows.append(row)

    return col_headers, rows


def results_as_pd_dataframe(col_headers, rows):
    cols = []
    num_cols = len(col_headers)
    for i in range(num_cols):
        cols.append([])

    for row in rows:
        for i in range(num_cols):
            cols[i].append(row[i])
    results = {}
    for i, col_header in enumerate(col_headers):
        results[col_header] = cols[i]
    return pd.DataFrame(results)

def wait_for_query_to_complete(query_execution_id):
    client = get_athena_client()
    while True:
        response = client.get_query_execution(QueryExecutionId=query_execution_id)
        status = response["QueryExecution"]["Status"]["State"]
        if status in ["SUCCEEDED", "FAILED", "CANCELLED"]:
            return status
        time.sleep(1)


def describe_query_execution_performance(query_execution_id):
    response = get_athena_client().get_query_execution(QueryExecutionId=query_execution_id)
    status = response["QueryExecution"]["Status"]["State"] == "SUCCEEDED"
    assert status, f"Query must have succeeded to get performance numbers. Query is currently {status}"
    stats = response["QueryExecution"]["Statistics"]
    return stats["EngineExecutionTimeInMillis"], stats["DataScannedInBytes"]


# sql = """
# SELECT hash
# , manifest_commit_message
# , "date"
# , "user"
# , "package"
# FROM "default"."manifest_refactor_test"
# WHERE logical_key IS NULL
# LIMIT 50
# """

sql = """
SELECT 
    "user"
    , package
    , hash
    , "date"
    , logical_key
    , replace(replace(physical_keys, '["'), '"]') as "physical_key"
    , size
    , meta
FROM "default"."manifest_refactor_test" 
WHERE logical_key IS NOT NULL
LIMIT 100
"""


if __name__ == '__main__':
    query_execution_id = query(sql, "default", "s3://armand-staging-t4/athena-results/")

    # query_execution_id = "87bfc6a8-d25d-4ad1-bdef-cec5d6a1edfa"

    outcome = wait_for_query_to_complete(query_execution_id)
    if outcome != "SUCCEEDED":
        print(f"Query {outcome}")
        quit()

    col_headers, rows = retrieve_results(query_execution_id)
    df = results_as_pd_dataframe(col_headers, rows)

    print(df)
    print()

    exec_dur, data_scanned = describe_query_execution_performance(query_execution_id)
    print(exec_dur/1000, "seconds,", data_scanned/1024/1024, "megabytes scanned")
