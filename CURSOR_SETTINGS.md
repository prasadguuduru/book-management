# Cursor Settings for AWS Serverless, TypeScript, and Terraform Development

## Core Settings

### 1. TypeScript Configuration
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.updateImportsOnFileMove.enabled": "always",
  "typescript.suggest.autoImports": true,
  "typescript.preferences.quoteStyle": "single",
  "typescript.format.enable": true,
  "typescript.format.semicolons": "insert",
  "typescript.format.insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces": true
}
```

### 2. AWS Serverless Settings
```json
{
  "aws.samcli.location": "/usr/local/bin/sam",
  "aws.credentials.profile": "default",
  "aws.region": "us-west-2",
  "aws.telemetry": false,
  "aws.lambda.enableLocalExecution": true
}
```

### 3. Terraform Settings
```json
{
  "terraform.languageServer": {
    "enabled": true,
    "args": []
  },
  "terraform.indexing": {
    "enabled": true,
    "liveIndexing": true
  },
  "terraform.validate": {
    "enable": true
  }
}
```

### 4. Editor Settings
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.rulers": [80, 100],
  "editor.wordWrap": "off",
  "editor.minimap.enabled": true
}
```

### 5. File Associations
```json
{
  "files.associations": {
    "*.ts": "typescript",
    "*.tsx": "typescriptreact",
    "*.tf": "terraform",
    "*.tfvars": "terraform",
    "serverless.yml": "yaml",
    "template.yaml": "yaml"
  }
}
```

### 6. Search Settings
```json
{
  "search.exclude": {
    "**/node_modules": true,
    "**/bower_components": true,
    "**/dist": true,
    "**/coverage": true,
    "**/.terraform": true
  }
}
```

### 7. Git Settings
```json
{
  "git.enableSmartCommit": true,
  "git.confirmSync": false,
  "git.autofetch": true,
  "git.pruneOnFetch": true
}
```

## Extension Recommendations

1. AWS Toolkit
2. Terraform
3. ESLint
4. Prettier
5. GitLens
6. DotENV
7. YAML
8. Thunder Client (for API testing)
9. Jest Runner
10. Error Lens

## Workspace Organization

```plaintext
.vscode/
  ├── settings.json        # Project-specific settings
  ├── extensions.json      # Recommended extensions
  ├── launch.json         # Debug configurations
  └── tasks.json          # Custom tasks
```

## Debug Configurations

### TypeScript Lambda Functions
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Lambda Local",
      "program": "${workspaceFolder}/node_modules/serverless/bin/serverless",
      "args": ["invoke", "local", "-f", "${input:functionName}"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Terraform Debug
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "terraform",
      "request": "launch",
      "name": "Terraform Plan",
      "program": "${workspaceFolder}",
      "args": ["plan"]
    }
  ]
}
```

## Task Configurations

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Build TypeScript",
      "type": "typescript",
      "tsconfig": "tsconfig.json",
      "problemMatcher": ["$tsc"],
      "group": {
        "kind": "build",
        "isDefault": true
      }
    },
    {
      "label": "Deploy to AWS",
      "type": "shell",
      "command": "serverless deploy",
      "options": {
        "cwd": "${workspaceFolder}"
      }
    },
    {
      "label": "Terraform Apply",
      "type": "shell",
      "command": "terraform apply -auto-approve",
      "options": {
        "cwd": "${workspaceFolder}/infrastructure"
      }
    }
  ]
}
```

## Code Snippets

### TypeScript Lambda Handler
```json
{
  "Lambda Handler": {
    "prefix": "lambda-handler",
    "body": [
      "import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';",
      "",
      "export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {",
      "  try {",
      "    $1",
      "    return {",
      "      statusCode: 200,",
      "      body: JSON.stringify({",
      "        message: 'Success',",
      "        data: $2",
      "      })",
      "    };",
      "  } catch (error) {",
      "    console.error('Error:', error);",
      "    return {",
      "      statusCode: 500,",
      "      body: JSON.stringify({",
      "        message: 'Internal Server Error',",
      "        error: error.message",
      "      })",
      "    };",
      "  }",
      "};",
      ""
    ]
  }
}
```

### Terraform Resource
```json
{
  "AWS Lambda Function": {
    "prefix": "aws-lambda",
    "body": [
      "resource \"aws_lambda_function\" \"${1:function_name}\" {",
      "  filename         = \"${2:lambda.zip}\"",
      "  function_name    = \"${3:function_name}\"",
      "  role            = aws_iam_role.lambda_role.arn",
      "  handler         = \"${4:index.handler}\"",
      "  runtime         = \"nodejs18.x\"",
      "",
      "  environment {",
      "    variables = {",
      "      ${5:ENV_VAR} = \"${6:value}\"",
      "    }",
      "  }",
      "",
      "  tags = {",
      "    Environment = var.environment",
      "    Project     = var.project_name",
      "  }",
      "}"
    ]
  }
}
```
