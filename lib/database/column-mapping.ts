// Column mapping between application (camelCase) and database (snake_case)

export const toSnakeCase = (str: string): string => {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

export const toCamelCase = (str: string): string => {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Map object keys from camelCase to snake_case
export const mapToSnakeCase = <T extends Record<string, any>>(obj: T): Record<string, any> => {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = toSnakeCase(key);
    result[snakeKey] = value;
  }
  return result;
}

// Map object keys from snake_case to camelCase
export const mapToCamelCase = <T extends Record<string, any>>(obj: T): Record<string, any> => {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = toCamelCase(key);
    result[camelKey] = value;
  }
  return result;
}

// Specific mappings for our schema
export const workflowColumnMap = {
  // camelCase -> snake_case
  toDb: {
    userId: 'user_id',
    publishedVersionId: 'published_version_id',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
  // snake_case -> camelCase
  fromDb: {
    user_id: 'userId',
    published_version_id: 'publishedVersionId',
    created_at: 'createdAt',
    updated_at: 'updatedAt'
  }
};

export const workflowVersionColumnMap = {
  toDb: {
    workflowId: 'workflow_id',
    isDraft: 'is_draft',
    isPublished: 'is_published',
    triggerConfig: 'trigger_config',
    userId: 'user_id',
    createdAt: 'created_at',
    publishedAt: 'published_at'
  },
  fromDb: {
    workflow_id: 'workflowId',
    is_draft: 'isDraft',
    is_published: 'isPublished',
    trigger_config: 'triggerConfig',
    user_id: 'userId',
    created_at: 'createdAt',
    published_at: 'publishedAt'
  }
};

// Helper to map workflow data to DB format
export const mapWorkflowToDb = (data: any) => {
  const mapped = { ...data };
  Object.entries(workflowColumnMap.toDb).forEach(([from, to]) => {
    if (from in mapped) {
      mapped[to] = mapped[from];
      if (to !== from) delete mapped[from];
    }
  });
  return mapped;
};

// Helper to map workflow data from DB format
export const mapWorkflowFromDb = (data: any) => {
  if (!data) return null;
  const mapped = { ...data };
  Object.entries(workflowColumnMap.fromDb).forEach(([from, to]) => {
    if (from in mapped) {
      mapped[to] = mapped[from];
      if (to !== from) delete mapped[from];
    }
  });
  return mapped;
};

// Helper to map workflow version data to DB format
export const mapWorkflowVersionToDb = (data: any) => {
  const mapped = { ...data };
  Object.entries(workflowVersionColumnMap.toDb).forEach(([from, to]) => {
    if (from in mapped) {
      mapped[to] = mapped[from];
      if (to !== from) delete mapped[from];
    }
  });
  return mapped;
};

// Helper to map workflow version data from DB format
export const mapWorkflowVersionFromDb = (data: any) => {
  if (!data) return null;
  const mapped = { ...data };
  Object.entries(workflowVersionColumnMap.fromDb).forEach(([from, to]) => {
    if (from in mapped) {
      mapped[to] = mapped[from];
      if (to !== from) delete mapped[from];
    }
  });
  return mapped;
};