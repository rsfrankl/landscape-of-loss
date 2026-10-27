.PHONY: data test web-test web-build

# Run the targets pipeline; writes web/public/data/ and docs/validation.md.
data:
	cd pipeline && Rscript -e 'targets::tar_make()'

# Pipeline unit and output-contract tests.
test:
	cd pipeline && Rscript -e 'testthat::test_dir("tests/testthat", stop_on_failure = TRUE)'

# Front-end logic tests (Vitest) and type check.
web-test:
	cd web && npm test && npm run check

# Production build of the site into web/dist/.
web-build:
	cd web && npm run build
