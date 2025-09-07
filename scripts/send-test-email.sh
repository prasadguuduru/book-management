#!/bin/bash
# Send a test email through the notification service

set -e

echo "📧 Sending test email through notification service..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get recipient email from user
RECIPIENT_EMAIL="${1:-test@example.com}"
echo -e "${BLUE}📧 Recipient: $RECIPIENT_EMAIL${NC}"
echo -e "${YELLOW}⚠️  Note: In QA environment, this email must be verified in SES${NC}"

# 1. Get authentication token
echo -e "${BLUE}🔐 Getting authentication token...${NC}"
TOKEN=$(curl -s -X POST "https://7tmom26ucc.execute-api.us-east-1.amazonaws.com/qa/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "john.author@example.com", "password": "password123"}' | jq -r '.token // .accessToken // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo -e "${RED}❌ Failed to get authentication token${NC}"
  echo "Please check if the auth service is working:"
  echo "curl -s 'https://7tmom26ucc.execute-api.us-east-1.amazonaws.com/qa/api/auth/login' -H 'Content-Type: application/json' -d '{\"email\": \"john.author@example.com\", \"password\": \"password123\"}'"
  exit 1
fi

echo -e "${GREEN}✅ Got token: ${TOKEN:0:20}...${NC}"

# 2. Send email notification
echo -e "${BLUE}📨 Sending email notification...${NC}"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "https://7tmom26ucc.execute-api.us-east-1.amazonaws.com/qa/api/notifications/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"type\": \"book_submitted\",
    \"recipientEmail\": \"$RECIPIENT_EMAIL\",
    \"variables\": {
      \"userName\": \"Test User\",
      \"bookTitle\": \"My Amazing Test Book\",
      \"bookId\": \"test-$(date +%s)\",
      \"actionUrl\": \"https://platform.com/review/test-$(date +%s)\"
    }
  }")

# Extract HTTP status and response body
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

echo -e "${BLUE}📊 Response (HTTP $HTTP_STATUS):${NC}"
echo "$RESPONSE_BODY" | jq . 2>/dev/null || echo "$RESPONSE_BODY"

# Check result
case "$HTTP_STATUS" in
  200)
    echo -e "${GREEN}✅ Email sent successfully!${NC}"
    echo -e "${BLUE}📬 Check your email inbox for the notification${NC}"
    ;;
  400)
    echo -e "${YELLOW}⚠️  Email sending failed - likely due to SES sandbox restrictions${NC}"
    echo -e "${BLUE}💡 This is expected if the recipient email is not verified in SES${NC}"
    ;;
  401)
    echo -e "${RED}❌ Authentication failed${NC}"
    ;;
  *)
    echo -e "${RED}❌ Unexpected response${NC}"
    ;;
esac

echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo -e "   • Service URL: https://7tmom26ucc.execute-api.us-east-1.amazonaws.com/qa"
echo -e "   • Recipient: $RECIPIENT_EMAIL"
echo -e "   • HTTP Status: $HTTP_STATUS"
echo -e "   • Notification Type: book_submitted"

echo ""
echo -e "${BLUE}💡 Next steps:${NC}"
echo -e "   1. If you got HTTP 400, the email address needs to be verified in SES"
echo -e "   2. Contact your AWS administrator to verify: $RECIPIENT_EMAIL"
echo -e "   3. Or use a different email that's already verified"
echo -e "   4. Check Lambda logs: aws logs tail /aws/lambda/qa-notification-service --region us-east-1"