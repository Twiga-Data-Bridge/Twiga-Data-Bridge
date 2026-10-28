import base64
import json
import os
import urllib.error
import urllib.request

# Reads the GEMINI_API_KEY environment variable configured on AWS Lambda
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
MODEL_NAME = "gemini-2.5-flash"
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent?key={GEMINI_API_KEY}"

SYSTEM_INSTRUCTION = """You are Twiga Msaidizi AI, an elite FMCG Retail Business Intelligence Specialist embedded in a Kenyan point-of-sale intelligence console (Simba POS).

YOUR RESPONSIBILITY:
Analyze the merchant's live store telemetry and provide accurate, profitable, and actionable business intelligence recommendations.

STRICT GROUNDING DIRECTIVES:
1. Ground every statement strictly in the provided STORE_CONTEXT JSON. Do not hallucinate figures.
2. Currency is always Kenyan Shillings (KSh / KES).
3. If the merchant writes in English, Swahili, or Sheng (e.g. 'mauzo ya leo', 'bidhaa inatoka sana', 'pesa ya mpesa'), respond naturally in the same language.
4. Structure your response with:
   - 📊 Summary Analysis (Bold numbers, volume shares, or shift velocity)
   - 💡 Strategic BI Takeaway (Why this pattern matters)
   - 👉 Actionable Advice (Concrete steps to execute at the counter)
5. Keep answers direct and readable on mobile screens.
"""

def lambda_handler(event, context):
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "POST,OPTIONS"
    }

    # Handle CORS Preflight
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS" or event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 204, "headers": headers, "body": ""}

    if not GEMINI_API_KEY:
        return {
            "statusCode": 500,
            "headers": headers,
            "body": json.dumps({"error": "GEMINI_API_KEY environment variable is missing on AWS Lambda."})
        }

    try:
        raw_body = event.get("body", "{}") or "{}"
        if event.get("isBase64Encoded", False):
            raw_body = base64.b64decode(raw_body).decode("utf-8")

        body = json.loads(raw_body)
        user_query = body.get("query", "").strip()
        store_context = body.get("store_context", {})

        if not user_query:
            return {
                "statusCode": 400,
                "headers": headers,
                "body": json.dumps({"error": "Query cannot be empty"})
            }

        # Build native Gemini REST payload
        context_str = json.dumps(store_context, indent=2)
        prompt_text = f"STORE_CONTEXT:\n{context_str}\n\nMERCHANT ENQUIRY:\n{user_query}"

        payload = {
            "system_instruction": {
                "parts": [{"text": SYSTEM_INSTRUCTION}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt_text}]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 600
            }
        }

        req = urllib.request.Request(
            GEMINI_API_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )

        with urllib.request.urlopen(req, timeout=12) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            answer = res_data["candidates"][0]["content"]["parts"][0]["text"]

        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({"answer": answer})
        }

    except urllib.error.HTTPError as http_err:
        err_body = http_err.read().decode("utf-8", errors="ignore")
        return {
            "statusCode": http_err.code,
            "headers": headers,
            "body": json.dumps({"error": f"Gemini API returned {http_err.code}", "details": err_body})
        }
    except Exception as exc:
        return {
            "statusCode": 500,
            "headers": headers,
            "body": json.dumps({"error": "Internal Lambda Handler Error", "details": str(exc)})
        }
