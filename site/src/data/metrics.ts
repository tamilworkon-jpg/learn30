// Evaluation metrics named or implied by AIF-C01 v1.2 (TS 1.3, 2.2, 3.4). Rendered by src/pages/cheatsheet/metrics.astro.
export interface Metric {
  name: string;
  formula?: string;
  what: string;
  useWhen: string;
  trap?: string;
  ts: string[];
  lessonRefs: string[];
}
export interface MetricGroup {
  id: string;
  title: string;
  intro: string;
  metrics: Metric[];
}

export const metricGroups: MetricGroup[] = [
  {
    id: 'classification',
    title: 'Classification (predicting a category)',
    intro: 'Built from the confusion matrix: true/false positives (TP/FP) and true/false negatives (TN/FN).',
    metrics: [
      {
        name: 'Accuracy',
        formula: '(TP + TN) ÷ all predictions',
        what: 'Share of all predictions that were correct.',
        useWhen: 'Classes are roughly balanced and every error costs about the same.',
        trap: 'Misleading on imbalanced data: a fraud model that always says "not fraud" can be 99% accurate and useless.',
        ts: ['1.3'],
        lessonRefs: ['day-06'],
      },
      {
        name: 'Precision',
        formula: 'TP ÷ (TP + FP)',
        what: 'Of everything the model flagged positive, how much really was positive.',
        useWhen: 'False positives are expensive — e.g. spam filters that must not hide real email.',
        trap: '"Of the predicted positives…" → precision. Raising the threshold usually raises precision and lowers recall.',
        ts: ['1.3'],
        lessonRefs: ['day-06'],
      },
      {
        name: 'Recall (sensitivity, true positive rate)',
        formula: 'TP ÷ (TP + FN)',
        what: 'Of all real positives, how many the model found.',
        useWhen: 'Missing a positive is costly — e.g. disease screening, fraud detection.',
        trap: '"Of the actual positives…" or "don\'t miss any" → recall.',
        ts: ['1.3'],
        lessonRefs: ['day-06'],
      },
      {
        name: 'F1 score',
        formula: '2 × (precision × recall) ÷ (precision + recall)',
        what: 'Harmonic mean of precision and recall — one number that balances both.',
        useWhen: 'Imbalanced classes where you care about both false positives and false negatives.',
        ts: ['1.3'],
        lessonRefs: ['day-06'],
      },
      {
        name: 'AUC-ROC',
        formula: 'Area under the TPR-vs-FPR curve (0.5 = random, 1.0 = perfect)',
        what: 'How well the model ranks positives above negatives across all thresholds.',
        useWhen: 'Comparing binary classifiers independent of a chosen threshold.',
        ts: ['1.3'],
        lessonRefs: ['day-06'],
      },
    ],
  },
  {
    id: 'regression',
    title: 'Regression (predicting a number)',
    intro: 'Measure how far numeric predictions are from the true values. Lower error is better.',
    metrics: [
      {
        name: 'MAE — mean absolute error',
        formula: 'average of |actual − predicted|',
        what: 'Average size of the error, in the same unit as the target.',
        useWhen: 'You want an easy-to-explain error ("off by $12 on average") that is not dominated by outliers.',
        ts: ['1.3'],
        lessonRefs: ['day-06'],
      },
      {
        name: 'RMSE — root mean squared error',
        formula: '√ average of (actual − predicted)²',
        what: 'Like MAE but squares errors first, so big misses count much more.',
        useWhen: 'Large errors are especially bad (e.g. demand forecasts that cause stock-outs).',
        trap: 'RMSE ≥ MAE always; RMSE is the classic regression metric — never use accuracy for regression.',
        ts: ['1.3'],
        lessonRefs: ['day-06'],
      },
      {
        name: 'R² (coefficient of determination)',
        formula: '1 − (squared error ÷ variance of actuals)',
        what: 'Share of the variation in the target that the model explains (1.0 = perfect).',
        useWhen: 'Explaining how much better the model is than always predicting the average.',
        ts: ['1.3'],
        lessonRefs: ['day-06'],
      },
    ],
  },
  {
    id: 'genai-text',
    title: 'Generated text (comparing output to a reference)',
    intro: 'Automatic metrics that score model output against human-written reference text.',
    metrics: [
      {
        name: 'ROUGE',
        formula: 'n-gram overlap, recall-oriented (ROUGE-N, ROUGE-L)',
        what: 'How much of the reference text\'s words/phrases appear in the generated text.',
        useWhen: 'Summarisation — did the summary capture the key content?',
        trap: 'ROUGE = summaRization (Recall). BLEU = translation (precision).',
        ts: ['3.4'],
        lessonRefs: ['day-20'],
      },
      {
        name: 'BLEU',
        formula: 'n-gram overlap, precision-oriented, with brevity penalty',
        what: 'How many of the generated words/phrases appear in the reference translation(s).',
        useWhen: 'Machine translation quality.',
        ts: ['3.4'],
        lessonRefs: ['day-20'],
      },
      {
        name: 'BERTScore',
        formula: 'cosine similarity of contextual embeddings, token by token',
        what: 'Semantic similarity — credits paraphrases that use different words with the same meaning.',
        useWhen: 'Meaning matters more than exact wording (open-ended answers, paraphrasing).',
        trap: 'ROUGE/BLEU miss synonyms; BERTScore uses embeddings, so it catches them.',
        ts: ['3.4'],
        lessonRefs: ['day-20'],
      },
      {
        name: 'Perplexity',
        formula: 'exp(average negative log-likelihood per token) — lower is better',
        what: 'How "surprised" a language model is by a text; measures how well it predicts language.',
        useWhen: 'Comparing language models during training/pre-training on the same data.',
        trap: 'Low perplexity ≠ factual or helpful answers; it says nothing about hallucinations.',
        ts: ['3.4'],
        lessonRefs: ['day-20'],
      },
    ],
  },
  {
    id: 'judgement',
    title: 'Human, benchmark and model-based evaluation',
    intro: 'For qualities automatic overlap scores cannot capture: helpfulness, tone, safety, correctness.',
    metrics: [
      {
        name: 'Human evaluation (human-in-the-loop)',
        what: 'People rate or compare outputs for relevance, accuracy, style, safety.',
        useWhen: 'Subjective quality, brand voice, high-stakes outputs; gold standard but slow and costly.',
        ts: ['3.4'],
        lessonRefs: ['day-20'],
      },
      {
        name: 'Benchmark datasets',
        what: 'Standard question sets (e.g. reasoning, knowledge, coding) to compare models on equal terms.',
        useWhen: 'Shortlisting FMs before testing on your own data.',
        trap: 'Public benchmark scores may not reflect your domain — always test on representative company data.',
        ts: ['3.4'],
        lessonRefs: ['day-20'],
      },
      {
        name: 'LLM-as-a-judge',
        what: 'A strong model grades another model\'s outputs against a rubric (correctness, completeness, harmfulness…).',
        useWhen: 'Scaling human-like evaluation cheaply; available in Amazon Bedrock Model Evaluation.',
        ts: ['3.4'],
        lessonRefs: ['day-20'],
      },
      {
        name: 'RAG & agent metrics',
        what: 'Retrieval: context relevance / precision / recall. Generation: faithfulness (groundedness), answer relevance, citation correctness. Agents: task completion, tool-call accuracy, steps taken.',
        useWhen: 'Evaluating whole workflows, not just the model — Bedrock evaluations support RAG (Knowledge Base) evaluation.',
        ts: ['3.4', '5.1'],
        lessonRefs: ['day-20'],
      },
    ],
  },
  {
    id: 'business',
    title: 'Business & operational metrics',
    intro: 'Model metrics only matter if they move business outcomes (TS 1.3, 2.2, 3.4).',
    metrics: [
      {
        name: 'ROI & cost per user / per interaction',
        what: 'Value delivered versus total cost (tokens, hosting, people). Cost per interaction = total cost ÷ conversations.',
        useWhen: 'Justifying or comparing AI solutions; choosing a smaller model or caching to cut cost.',
        ts: ['1.3', '2.2', '3.4'],
        lessonRefs: ['day-11'],
      },
      {
        name: 'Task completion & user satisfaction',
        what: 'Share of user goals achieved without escalation; CSAT / thumbs-up feedback.',
        useWhen: 'Chatbots and assistants — the v1.2 guide lists these as alignment metrics.',
        ts: ['3.4'],
        lessonRefs: ['day-20'],
      },
      {
        name: 'Conversion, ARPU, CLV, efficiency',
        what: 'Conversion rate, average revenue per user, customer lifetime value, time or cost saved per task.',
        useWhen: 'Measuring business value of GenAI (recommendations, marketing content, agent assist).',
        ts: ['2.2'],
        lessonRefs: ['day-11'],
      },
      {
        name: 'Latency & throughput',
        what: 'Time to first token / full response; requests or tokens per second.',
        useWhen: 'Real-time apps; trading off model size, cost and speed when selecting an FM.',
        ts: ['2.2', '3.1'],
        lessonRefs: ['day-15'],
      },
    ],
  },
];
