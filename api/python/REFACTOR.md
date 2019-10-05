# Refactoring .quilt/ layout

Functional DDL, skipping difficult array/json cols

```
CREATE EXTERNAL TABLE `manifest_refactor_test`(
  `logical_key` string, 
  `size` int)
PARTITIONED BY ( 
  `user` string, 
  `package` string, 
  `date` date, 
  `hash` string)
ROW FORMAT SERDE 
  'org.openx.data.jsonserde.JsonSerDe' 
STORED AS INPUTFORMAT 
  'org.apache.hadoop.mapred.TextInputFormat' 
OUTPUTFORMAT 
  'org.apache.hadoop.hive.ql.io.IgnoreKeyTextOutputFormat'
LOCATION
  's3://armand-staging-t4/.quilt-test'
TBLPROPERTIES (
  'has_encrypted_data'='false')
```

With extra fields


```
CREATE EXTERNAL TABLE `manifest_refactor_test`(
  `logical_key` string, 
  `size` int,
  `physical_keys` string,
  `meta` string)
PARTITIONED BY ( 
  `user` string, 
  `package` string, 
  `date` date, 
  `hash` string)
ROW FORMAT SERDE 
  'org.openx.data.jsonserde.JsonSerDe' 
STORED AS INPUTFORMAT 
  'org.apache.hadoop.mapred.TextInputFormat' 
OUTPUTFORMAT 
  'org.apache.hadoop.hive.ql.io.IgnoreKeyTextOutputFormat'
LOCATION
  's3://armand-staging-t4/.quilt-test'
TBLPROPERTIES (
  'has_encrypted_data'='false')
```