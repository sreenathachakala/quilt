import boto3
import time
import pandas as pd


pd.set_option('display.width', 10000)
pd.set_option('display.max_colwidth', -1)
pd.set_option('display.max_columns', 500)
pd.set_option('display.max_rows', 500)


def get_athena_client():
    # return boto3.session.Session(profile_name='staging', region_name="us-east-1").client("athena")
    return boto3.session.Session(region_name="us-east-1").client("athena")



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
    elif col_type == "bigint":
        return int(var_char_value)
    elif col_type == "double":
        return float(var_char_value)
    elif col_type == "json":
        # return json.dumps(var_char_value)
        return var_char_value
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

    # exec_dur, data_scanned = describe_query_execution_performance(query_execution_id)
    #     print(exec_dur/1000, "seconds,", data_scanned/1024/1024, "megabytes scanned")


OUTPUT_LOCATION = "s3://quilt-ml-data/athena/demo/"
DB = "default"

class Query:
    def __init__(self, package=None, tophash=None):
        self.package = package
        self.tophash = tophash
        self.tophash_prefix = None
        if tophash is not None:
            self.tophash_prefix = tophash[:2]
        self.select_params = []
        self.where_clauses = []

    def select(self, params):
        assert isinstance(params, list)
        for p in params:
            assert isinstance(p, str) or isinstance(p, dict)
        self.select_params = params
        return self

    def where(self, where_clauses):
        assert isinstance(where_clauses, list)
        for p in where_clauses:
            assert isinstance(p, str) or isinstance(p, dict)
        self.where_clauses = where_clauses
        return self


    def _gen_select_sql(self):
        select_sql = "SELECT"
        for i, select_param in enumerate(self.select_params):
            select_clause = "\n, " if i>0 else " "
            if isinstance(select_param, str):
                select_clause += select_param
            if isinstance(select_param, dict):
                assert len(select_param.keys()) == 1
                k, v = list(select_param.items())[0]
                # v = select_param[k]
                select_clause += f"""   {v} as {k}   """
            select_sql += select_clause
        return select_sql

    def _gen_where_sql(self):
        if self.package is not None:
            self.where_clauses.append(f"   package = '{self.package}'   ")
        if self.tophash is not None:
            self.where_clauses.append(f"""   hash = '{self.tophash}'   """)
            self.where_clauses.append(f"""   hash_prefix = '{self.tophash_prefix}'   """)


        where_sql = ""
        for i, clause in enumerate(self.where_clauses):
            clause_sql = "WHERE" if i==0 else "\nAND"
            clause_sql += f" {clause}"
            where_sql += clause_sql
        return where_sql



    def _gen_sql(self):
        sql = \
f"""
{self._gen_select_sql()}
FROM "default"."metadata_service_demo" 
{self._gen_where_sql()}
"""
        return sql


    def _gen_sql_2(self):
        sql = \
f"""

WITH
manifest_table as (
  SELECT package 
  , manifest_commit_message 
  , regexp_extract("$path",'[ \w-]+?(?=\.)') AS hash
  FROM "default"."metadata_service_demo"
  WHERE logical_key IS NULL 
),
entry_table as (
  SELECT logical_key
  , package AS "entry_table_package"
  , size
  , object_hash
  , hash_prefix
  , meta
  , regexp_extract("$path", '[ \w-]+?(?=\.)') AS "entry_table_hash" 
  , replace(replace(physical_keys, '["'), '"]') as physical_key
  FROM "default"."metadata_service_demo"
  WHERE logical_key IS NOT NULL
)
{self._gen_select_sql()}
FROM entry_table
JOIN manifest_table
ON entry_table.entry_table_package = manifest_table.package 
AND entry_table.entry_table_hash = manifest_table.hash 
{self._gen_where_sql()}
"""
        return sql


    def display_sql(self):
        print(self._gen_sql_2())

    def run(self, verbose=False):
        execution_id = query(self._gen_sql_2(), DB, OUTPUT_LOCATION)
        outcome = wait_for_query_to_complete(execution_id)
        if outcome != "SUCCEEDED":
            print(f"Query {outcome}")
            return None

        col_headers, rows = retrieve_results(execution_id)
        df = results_as_pd_dataframe(col_headers, rows)
        if verbose:
            exec_dur, data_scanned = describe_query_execution_performance(execution_id)
            print(exec_dur / 1000, "seconds,", data_scanned / 1024 / 1024, "megabytes scanned")
        return df





def query_images_containing_obj_in_split(obj='car', split='train2017'):
    q = Query(package="coco-trainval2017", tophash='5708d60b8f27213ce3936d79a698916b68415e3efa0b5474d913de59f8ed999c')
    r = q.select([
            {"count": "count(*)"}
        ]) \
        .where([
            f"""   json_array_contains(json_extract(meta, '$.user_meta.coco_meta.annotation_info["category.names"]'), '{obj}')   """,
            f"""   json_extract_scalar(meta, '$.user_meta.split') IN ('{split}')   """
        ])

    r.display_sql()
    return r

def query_packages_that_contain_obj(s3_url="s3://quilt-ml-data/data/raw/train2017/000000001164.jpg"):
    if "?versionId" in s3_url:
        print("There is a temporary bug that prevents us from matching on versionId. This will be fixed ASAP, but until "
              "then we can only check if the s3 key is used by multiple packages")
        s3_url = s3_url.split("?versionId")[0]

    q = Query()
    q = q.select([
            "package",
            "manifest_commit_message",
            "hash",
            "physical_key"
        ]) \
        .where([
            f"""   regexp_replace(physical_key, '\?.+') = '{s3_url}' """
        ])

    q.display_sql()
    return q


if __name__ == '__main__':

    print("This query shows which packages use any version of this s3 object: s3://quilt-ml-data/data/raw/train2017/000000001164.jpg")
    print()
    q = Query()
    r = q.select(["package", "manifest_commit_message", "hash"]) \
         .where(["""regexp_replace(physical_key, '\?.+') = 's3://quilt-ml-data/data/raw/train2017/000000001164.jpg' """])
    df = q.run()
    print(df)
    print()
    print("---")
    print()




    print("This query shows the total size of the train2017 data in this package: coco-trainval2017 @ e24d422564")
    print()
    q = Query(package="coco-trainval2017", tophash='5708d60b8f27213ce3936d79a698916b68415e3efa0b5474d913de59f8ed999c')
    q = q.select([{"total_size_gb": "1.0*sum(size)/1024/1024/1024"}]) \
         .where(["json_extract_scalar(meta, '$.user_meta.split') IN ('train2017') "])
    results_dataframe = q.run()
    print()
    print(results_dataframe)
    print()
    print("---")
    print()



    print("This query lists all COCO training images that contain car labels:")
    q = Query(package="coco-trainval2017", tophash='5708d60b8f27213ce3936d79a698916b68415e3efa0b5474d913de59f8ed999c')
    q = q.select([
        "logical_key",
        {"objects_in_image": """json_extract(meta, '$.user_meta.coco_meta.annotation_info["category.names"]')"""},
        {"split": """json_extract_scalar(meta, '$.user_meta.split')"""},
        "package",
        "physical_key"
    ]).where([
        """json_array_contains(json_extract(meta, '$.user_meta.coco_meta.annotation_info["category.names"]'), 'car')""",
        """json_extract_scalar(meta, '$.user_meta.split') IN ('train2017') """
    ])
    results_dataframe = q.run()
    print()
    print(results_dataframe)
    print()
    print("---")
    print()








