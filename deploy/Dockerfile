FROM python:3.13-alpine
WORKDIR /app
COPY server.py .
RUN adduser -D -H web
USER web
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8000/health || exit 1
CMD ["python", "-u", "server.py"]
