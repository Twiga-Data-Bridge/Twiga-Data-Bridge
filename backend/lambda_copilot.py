import json
import os
import urllib.request
import urllib.error

# Environment Variables: Configure GROQ_API_KEY or GEMINI_API_KEY in AWS Lambda console
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

SYSTEM_PROMPT = """You are Twiga Msaidizi AI, an elite FMCG Retail Business Intelligence Specialist embedded in a Kenyan point-of-sale intelligence console (Simba POS).

YOUR RESPONSIBILITY:
Analyze the merchant's live store telemetry and provide accurate, profitable, and actionable business intelligence recommendations.

STRICT GROUNDING DIRECTIVES:
1. Ground every numeric statement strictly in the provided STORE_CONTEXT JSON. Do not hallucinate or guess sales figures.
2. Currency is always Kenyan Shillings (KSh / KES).
3. If the merchant writes in English, Swahili, or Sheng (e.g., 'mauzo ya leo', 'bidhaa inatoka sana', 'pesa ya mpesa'), respond naturally in the same language.
4. Structure your response with:
   - 📊 Summary Analysis (Bold numbers, volume shares, or shift velocity)
   - 💡 Strategic BI Takeaway (Why this pattern matters)
   - 👉 Actionable Advice (Concrete steps to execute at the counter)
5. Keep answers concise, direct, and thumb-readable on mobile devices. Avoid long theoretical text.
"""

def lambda_handler(event, context):
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "POST,OPTIONS"
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    try:
        body = json.loads(event.get("body", "{}"))
        user_query = body.get("query", "").strip()
        store_context = body.get("store_context", {})

        if not user_query:
            return {
                "statusCode": 400,
                "headers": headers,
                "body": json.dumps({"error": "Query cannot be empty"})
            }

        # Build Context-Injected Messages
        context_str = json.dumps(store_context, indent=2)
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"STORE_CONTEXT:\n{context_str}\n\nMERCHANT ENQUIRY:\n{user_query}"}
            ],
            "temperature": 0.2,
            "max_tokens": 450
        }

        # Dispatch to Groq / LLM
        req = urllib.request.Request(
            GROQ_API_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {GROQ_API_KEY}"
            }
        )

        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            answer = res_data["choices"][0]["message"]["content"]

        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({"answer": answer})
        }

    except urllib.error.HTTPError as e:
        error_msg = e.read().decode("utf-8")
        return {
            "statusCode": 500,
            "headers": headers,
            "body": json.dumps({"error": "LLM Provider Error", "details": error_msg})
        }
    except Exception as exc:
        return {
            "statusCode": 500,
            "headers": headers,
            "body": json.dumps({"error": str(exc)})
        }
