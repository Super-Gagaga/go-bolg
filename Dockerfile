FROM golang:1.26-alpine AS builder

WORKDIR /src

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath \
    -ldflags="-s -w" \
    -o /out/server \
    ./cmd/server

FROM alpine:3.22

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S app \
    && adduser -S app -G app

WORKDIR /app

COPY --from=builder /out/server /app/server
COPY config.yaml /app/config.yaml
COPY web /app/web
COPY image /app/image

RUN mkdir -p /app/uploads \
    && chown -R app:app /app/uploads

USER app
EXPOSE 8080

ENTRYPOINT ["/app/server"]
