import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

// Set before any app imports so config picks these up
process.env.DATABASE_PATH = join(tmpdir(), `a2-gateway-test-${randomUUID()}.db`);
process.env.OTP_REQUEST_LIMIT = '20';
