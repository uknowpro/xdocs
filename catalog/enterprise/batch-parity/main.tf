terraform {
  required_providers {
    google = { source = "hashicorp/google", version = "~> 7.0" }
  }
}
variable "project_id" { type = string }
provider "google" { project = var.project_id }
resource "google_bigquery_dataset" "batch" {
  dataset_id = "batch_parity"
  location   = "US"
}
resource "google_bigquery_table" "input" {
  dataset_id = google_bigquery_dataset.batch.dataset_id
  table_id   = "orders"
  schema = jsonencode([
    { name = "business_date", type = "DATE", mode = "REQUIRED" },
    { name = "order_id", type = "STRING", mode = "REQUIRED" },
    { name = "amount", type = "NUMERIC", mode = "REQUIRED" }
  ])
}
resource "google_bigquery_table" "published" {
  dataset_id = google_bigquery_dataset.batch.dataset_id
  table_id   = "published_totals"
  schema = jsonencode([
    { name = "business_date", type = "DATE", mode = "REQUIRED" },
    { name = "order_id", type = "STRING", mode = "REQUIRED" },
    { name = "cents", type = "NUMERIC", mode = "REQUIRED" }
  ])
}
resource "google_bigquery_table" "audit" {
  dataset_id = google_bigquery_dataset.batch.dataset_id
  table_id   = "cutover_decisions"
  schema = jsonencode([
    { name = "run_time", type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "chosen", type = "STRING", mode = "REQUIRED" },
    { name = "difference_count", type = "INTEGER", mode = "REQUIRED" }
  ])
}
resource "google_bigquery_routine" "legacy" {
  dataset_id   = google_bigquery_dataset.batch.dataset_id
  routine_id   = "legacy_cents"
  routine_type = "SCALAR_FUNCTION"
  language     = "SQL"
  arguments {
    name      = "amount"
    data_type = jsonencode({ typeKind = "NUMERIC" })
  }
  definition_body = "ROUND(amount * 100)"
}
resource "google_bigquery_routine" "candidate" {
  dataset_id   = google_bigquery_dataset.batch.dataset_id
  routine_id   = "candidate_cents"
  routine_type = "SCALAR_FUNCTION"
  language     = "SQL"
  arguments {
    name      = "amount"
    data_type = jsonencode({ typeKind = "NUMERIC" })
  }
  definition_body = "ROUND(amount * 100, 0, 'ROUND_HALF_EVEN')"
}
resource "google_service_account" "runner" {
  account_id = "batch-parity-runner"
}
resource "google_project_iam_member" "jobs" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.runner.email}"
}
resource "google_bigquery_dataset_iam_member" "writer" {
  dataset_id = google_bigquery_dataset.batch.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${google_service_account.runner.email}"
}
resource "google_bigquery_data_transfer_config" "compare" {
  display_name         = "Compare and publish daily order totals"
  data_source_id       = "scheduled_query"
  location             = google_bigquery_dataset.batch.location
  schedule             = "every day 02:00"
  service_account_name = google_service_account.runner.email
  depends_on           = [google_project_iam_member.jobs, google_bigquery_dataset_iam_member.writer]
  params = {
    query = <<-SQL
      DECLARE batch_day DATE DEFAULT DATE_SUB(DATE(@run_time), INTERVAL 1 DAY);
      DECLARE differences INT64;
      CREATE TEMP TABLE frozen AS
        SELECT order_id, amount FROM `${google_bigquery_table.input.dataset_id}.${google_bigquery_table.input.table_id}` WHERE business_date = batch_day;
      ASSERT (SELECT COUNT(*) FROM frozen) > 0 AS 'Input is empty';
      CREATE TEMP TABLE baseline AS
        SELECT order_id, SUM(`${google_bigquery_routine.legacy.dataset_id}.${google_bigquery_routine.legacy.routine_id}`(amount)) AS cents FROM frozen GROUP BY order_id;
      CREATE TEMP TABLE trial AS
        SELECT order_id, SUM(`${google_bigquery_routine.candidate.dataset_id}.${google_bigquery_routine.candidate.routine_id}`(amount)) AS cents FROM frozen GROUP BY order_id;
      SET differences = (SELECT COUNT(*) FROM baseline b FULL OUTER JOIN trial t USING(order_id)
        WHERE b.cents IS DISTINCT FROM t.cents);
      BEGIN TRANSACTION;
      DELETE FROM `${google_bigquery_table.published.dataset_id}.${google_bigquery_table.published.table_id}` WHERE business_date = batch_day;
      INSERT INTO `${google_bigquery_table.published.dataset_id}.${google_bigquery_table.published.table_id}` (business_date,order_id,cents)
        SELECT batch_day,order_id,cents FROM trial WHERE differences = 0
        UNION ALL SELECT batch_day,order_id,cents FROM baseline WHERE differences > 0;
      DELETE FROM `${google_bigquery_table.audit.dataset_id}.${google_bigquery_table.audit.table_id}` WHERE run_time = @run_time;
      INSERT INTO `${google_bigquery_table.audit.dataset_id}.${google_bigquery_table.audit.table_id}`
        VALUES (@run_time, IF(differences = 0,'candidate','legacy'), differences);
      COMMIT TRANSACTION;
    SQL
  }
}
