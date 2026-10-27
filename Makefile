.PHONY: data test

# Run the targets pipeline; writes web/public/data/ and docs/validation.md.
data:
	cd pipeline && Rscript -e 'targets::tar_make()'

# Pipeline unit and output-contract tests.
test:
	cd pipeline && Rscript -e 'testthat::test_dir("tests/testthat", stop_on_failure = TRUE)'
