INSERT INTO loans (token, amount, interest_rate, issue_date, return_date, status)
VALUES ('smoke_test_loan_2026', 150000, 12, '2026-07-24', '2026-12-31', 'draft')
ON CONFLICT (token) DO NOTHING;