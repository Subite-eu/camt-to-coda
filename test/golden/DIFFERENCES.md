# Golden File Test Differences

Golden files not yet generated. To generate:
1. Build the Java converter: `cd java/BankFileConverter && sh build.sh`
2. Run: `sh local_test_FS.sh 53`
3. Copy output: `cp test_data/fs/out/*.cod ../../test/golden/`

## Known intentional differences
- signCode: TS uses 0=credit, 1=debit (matches CODA spec); Java had the same after fix
- Sequence number: TS uses working-day calculator; Java used the same algorithm
