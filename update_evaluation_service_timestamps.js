// Script to update promotion evaluation service to use BIGINT timestamps
// This shows the key changes needed in the service

const changes = {
  // In createEvaluationRecord method, line ~400
  oldCode: `
        created_at: new Date(),
        expires_at: data.expiresAt,
  `,
  newCode: `
        created_at: BigInt(Date.now()),
        expires_at: BigInt(data.expiresAt.getTime()),
  `,

  // In storeEvaluation method, line ~800
  oldCode: `
          expires_at: new Date(Date.now() + 60 * 60 * 1000), // 60 minutes
  `,
  newCode: `
          created_at: BigInt(Date.now()),
          expires_at: BigInt(Date.now() + 60 * 60 * 1000), // 60 minutes
  `,

  // In validateEvaluationForOrder method, line ~1000
  oldCode: `
      // const now = new Date();
      // const expiresAt = new Date(evaluation.expires_at);
      // 
      // if (expiresAt < now) {
      //   return {
      //     isValid: false,
      //     reason: 'Evaluation has expired'
      //   };
      // }
  `,
  newCode: `
      const now = BigInt(Date.now());
      const expiresAt = evaluation.expires_at;
      
      if (expiresAt < now) {
        return {
          isValid: false,
          reason: 'Evaluation has expired'
        };
      }
  `,

  // In getUserActiveEvaluations method, line ~1100
  oldCode: `
        created_at: evaluation.created_at,
        expires_at: evaluation.expires_at
  `,
  newCode: `
        created_at: Number(evaluation.created_at),
        expires_at: Number(evaluation.expires_at)
  `
};

console.log('Key changes needed in promotion-evaluation.service.ts:');
console.log(JSON.stringify(changes, null, 2));
