exports.up = (pgm) => {
  // Users: vendors, reviewers and admins
  pgm.createTable("users", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    email: {
      type: "varchar(255)",
      notNull: true,
      unique: true,
    },
    password_hash: {
      type: "varchar(255)",
      notNull: true,
    },
    role: {
      type: "varchar(20)",
      notNull: true,
      default: "vendor",
    },
    is_active: {
      type: "boolean",
      notNull: true,
      default: true,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.addConstraint("users", "users_role_check", {
    check: "role IN ('vendor', 'reviewer', 'admin')",
  });

  // Sessions: supports genuine logout invalidation
  pgm.createTable("sessions", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    refresh_token_hash: {
      type: "varchar(255)",
      notNull: true,
    },
    expires_at: {
      type: "timestamptz",
      notNull: true,
    },
    revoked_at: {
      type: "timestamptz",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("sessions", "user_id");

  // Invoice documents
  pgm.createTable("documents", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    vendor_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
    },
    status: {
      type: "varchar(20)",
      notNull: true,
      default: "needs_review",
    },
    source_type: {
      type: "varchar(20)",
      notNull: true,
    },
    raw_text: {
      type: "text",
      notNull: true,
    },
    vendor_name: {
      type: "varchar(255)",
    },
    invoice_number: {
      type: "varchar(100)",
    },
    invoice_date: {
      type: "date",
    },
    total: {
      type: "numeric(12,2)",
    },
    currency: {
      type: "varchar(3)",
      default: "INR",
    },
    flags: {
      type: "jsonb",
      notNull: true,
      default: "[]",
    },
    reviewed_by: {
      type: "uuid",
      references: "users(id)",
    },
    reviewed_at: {
      type: "timestamptz",
    },
    rejection_reason: {
      type: "text",
    },
    paid_at: {
      type: "timestamptz",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.addConstraint("documents", "documents_status_check", {
    check:
      "status IN ('extracted', 'needs_review', 'approved', 'rejected', 'paid')",
  });

  pgm.addIndex("documents", ["vendor_id", "status"]);
  pgm.addIndex("documents", ["created_at"]);

  // Payment events: unique event_id ensures idempotency
  pgm.createTable("payment_events", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    event_id: {
      type: "varchar(255)",
      notNull: true,
      unique: true,
    },
    document_id: {
      type: "uuid",
      references: "documents(id)",
    },
    payload: {
      type: "jsonb",
      notNull: true,
    },
    result: {
      type: "varchar(30)",
      notNull: true,
    },
    received_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("payment_events", "document_id");
};

exports.down = (pgm) => {
  pgm.dropTable("payment_events");
  pgm.dropTable("documents");
  pgm.dropTable("sessions");
  pgm.dropTable("users");
};
