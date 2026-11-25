package ru.mashina.mobile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;

final class ServerAddressTest {
    public static void main(String[] args) throws Exception {
        var cases = Files.readAllLines(Path.of(args[0]));
        for (String test : cases) {
            String[] entry = test.split("\t", -1);
            String expected = entry[1].equals("-") ? null : entry[1];
            String actual = ServerAddress.parse(entry[0]);
            if (!Objects.equals(expected, actual)) {
                throw new AssertionError(entry[0] + " expected " + expected + ", got " + actual);
            }
            if (actual != null && !actual.equals(ServerAddress.origin(actual + "/api/v1/health"))) {
                throw new AssertionError("Server origin does not match a request to " + actual);
            }
        }
        System.out.println("Android server address cases passed: " + cases.size());
    }
}
